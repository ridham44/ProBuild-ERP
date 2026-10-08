import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { GRN_SORT_FIELDS } from '@probuild/shared';
import type {
  CreateGoodsReceiptInput,
  GoodsReceiptLineInput,
  GoodsReceiptListQuery,
  InspectionInput,
  PostGoodsReceiptInput,
  SessionUser,
  UpdateGoodsReceiptInput,
} from '@probuild/shared';
import { AccessService } from '../../common/access.service';
import { AuditedService } from '../../common/audited-service';
import { BusinessRuleError, NotFoundError } from '../../common/errors/domain-errors';
import { buildOrderBy, containsAny, dateRange } from '../../common/list';
import { dec, nonNegative, ZERO } from '../../common/money';
import { paginate } from '../../common/pagination';
import { ProjectAccessService } from '../../common/project-access.service';
import { ActivityService } from '../../engines/activity/activity.service';
import { AuditService } from '../../engines/audit/audit.service';
import { NotificationsService } from '../../engines/notifications/notifications.service';
import { NumberingService } from '../../engines/numbering/numbering.service';
import { StockLedgerService, StockMovement } from '../../engines/stock-ledger/stock-ledger.service';
import { Db, PrismaService } from '../../prisma/prisma.service';
import { allocateFreight, landedUnitCost, resolveQcSplit, toBaseQty } from '../inventory/stock-math';
import { baseUnitFactor } from '../inventory/units';

const DOC = 'GOODS_RECEIPT';
const MODULE = 'procurement.receipt';
const PO_DOC = 'PURCHASE_ORDER';
const RECEIVABLE_PO = ['APPROVED', 'SENT', 'PARTIALLY_RECEIVED'];

type Action = 'VIEW' | 'CREATE' | 'EDIT' | 'POST' | 'CANCEL' | 'APPROVE' | 'OVERRIDE';

const LINE_INCLUDE = {
  item: { select: { id: true, sku: true, name: true, baseUnit: true, trackBatch: true, trackSerial: true, trackExpiry: true } },
  location: { select: { id: true, code: true, fullPath: true } },
  inspections: { orderBy: { inspectedAt: 'asc' } },
  orderLine: { select: { id: true, lineNo: true, qty: true, cancelledQty: true, receivedQty: true, unit: true, unitPrice: true } },
} satisfies Prisma.GoodsReceiptLineInclude;
type LineWithRefs = Prisma.GoodsReceiptLineGetPayload<{ include: typeof LINE_INCLUDE }>;

type ResolvedLine = {
  input: GoodsReceiptLineInput;
  orderLine: Prisma.PurchaseOrderLineGetPayload<{ include: { item: { include: { unitConversions: true } } } }>;
};

/**
 * Goods receipt (GRN) workflow:
 *   DRAFT -> POSTED (one transaction: stock ledger, batches/serials, PO quantities and status, last purchase cost, audit)
 *   DRAFT -> CANCELLED (nothing was stocked)
 *   POSTED -> CANCELLED (stock reversed through the ledger; refused once any of it has been consumed)
 *
 * QC: an inspection per line decides where stock lands. Accepted -> AVAILABLE, quarantined -> QUARANTINE (a later
 * decision releases it to AVAILABLE or rejects it), rejected -> NOT stocked at all (it never enters the ledger; the goods
 * go back to the supplier). Only accepted + quarantined units count as received on the PO, so rejected units stay open
 * for redelivery.
 *
 * Costing: stock is valued at landed cost per base unit = (PO line net value after discount + the line's share of PO
 * freight) / ordered qty / base factor. Freight is shared in proportion to line net value; tax is excluded (input VAT).
 * Receipts into a project warehouse stay inventory; the cost reaches the project when material is issued to it.
 */
@Injectable()
export class GoodsReceiptsService extends AuditedService {
  constructor(
    prisma: PrismaService,
    audit: AuditService,
    private readonly access: AccessService,
    private readonly projectAccess: ProjectAccessService,
    private readonly activity: ActivityService,
    private readonly numbering: NumberingService,
    private readonly stock: StockLedgerService,
    private readonly notifications: NotificationsService,
  ) {
    super(prisma, audit);
  }

  // ---- Queries -----------------------------------------------------------------------------------

  list(user: SessionUser, query: GoodsReceiptListQuery) {
    const projectScope = this.access.projectScope(user, MODULE, 'VIEW');
    const projectFilter: Prisma.PurchaseOrderWhereInput =
      projectScope === 'ALL'
        ? query.projectId ? { projectId: query.projectId } : {}
        : { projectId: query.projectId ? (projectScope.includes(query.projectId) ? query.projectId : { in: [] }) : { in: projectScope } };
    const where: Prisma.GoodsReceiptWhereInput = {
      companyId: user.companyId,
      deletedAt: null,
      ...this.access.warehouseWhere(user, MODULE, 'VIEW'),
      order: projectFilter,
      ...(query.status ? { status: query.status } : {}),
      ...(query.orderId ? { orderId: query.orderId } : {}),
      ...(query.supplierId ? { supplierId: query.supplierId } : {}),
      ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
      ...(dateRange(query.from, query.to) ? { receiptDate: dateRange(query.from, query.to) } : {}),
      ...containsAny(query.search, ['number', 'supplierDrNo', 'vehicle', 'driver']),
    };
    return paginate(
      (args) =>
        this.prisma.goodsReceipt.findMany({
          where,
          orderBy: buildOrderBy(query.sort, GRN_SORT_FIELDS, [{ createdAt: 'desc' }]),
          include: {
            supplier: { select: { id: true, code: true, name: true } },
            warehouse: { select: { id: true, code: true, name: true } },
            order: { select: { id: true, number: true, projectId: true } },
            _count: { select: { lines: true } },
          },
          ...args,
        }),
      query,
    );
  }

  /** Per PO line: ordered, previously received, remaining and what a new receipt could take, for building a receipt. */
  async receivableLines(user: SessionUser, orderId: string) {
    const po = await this.loadOrder(user, orderId, 'VIEW');
    const lines = await this.prisma.purchaseOrderLine.findMany({
      where: { orderId },
      orderBy: { lineNo: 'asc' },
      include: { item: { select: { id: true, sku: true, name: true, baseUnit: true, trackBatch: true, trackSerial: true, trackExpiry: true } } },
    });
    const company = await this.prisma.company.findUniqueOrThrow({ where: { id: user.companyId }, select: { overReceiptTolerancePct: true } });
    return {
      orderId,
      orderNumber: po.number,
      status: po.status,
      receivable: RECEIVABLE_PO.includes(po.status),
      overReceiptTolerancePct: company.overReceiptTolerancePct.toString(),
      lines: lines.map((l) => {
        const open = nonNegative(l.qty.minus(l.receivedQty).minus(l.cancelledQty));
        return {
          orderLineId: l.id, lineNo: l.lineNo, item: l.item, description: l.description, unit: l.unit,
          ordered: l.qty.toString(), previouslyReceived: l.receivedQty.toString(), cancelled: l.cancelledQty.toString(), remaining: open.toString(),
        };
      }),
    };
  }

  async get(user: SessionUser, id: string) {
    const grn = await this.load(user, id, 'VIEW');
    const [lines, supplier, warehouse, order, receivedBy, project] = await Promise.all([
      this.prisma.goodsReceiptLine.findMany({ where: { receiptId: id }, orderBy: { lineNo: 'asc' }, include: LINE_INCLUDE }),
      this.prisma.supplier.findUniqueOrThrow({ where: { id: grn.supplierId }, select: { id: true, code: true, name: true } }),
      this.prisma.warehouse.findUniqueOrThrow({ where: { id: grn.warehouseId }, select: { id: true, code: true, name: true } }),
      this.prisma.purchaseOrder.findUniqueOrThrow({ where: { id: grn.orderId }, select: { id: true, number: true, status: true, projectId: true } }),
      this.prisma.user.findUnique({ where: { id: grn.receivedById }, select: { id: true, name: true } }),
      this.prisma.purchaseOrder
        .findUniqueOrThrow({ where: { id: grn.orderId }, select: { project: { select: { id: true, code: true, name: true } } } })
        .then((p) => p.project),
    ]);
    const earlier = await this.postedBefore(grn, lines);
    return {
      ...grn,
      supplier,
      warehouse,
      order,
      project,
      receivedBy,
      lines: lines.map((l) => this.lineView(grn.status, l, earlier.get(l.orderLineId) ?? ZERO)),
    };
  }

  async activityFor(user: SessionUser, id: string) {
    await this.load(user, id, 'VIEW');
    return this.activity.forDocument({ companyId: user.companyId, entityType: DOC, entityId: id });
  }

  // ---- Draft -------------------------------------------------------------------------------------

  async create(user: SessionUser, input: CreateGoodsReceiptInput) {
    const po = await this.loadOrder(user, input.orderId, 'CREATE');
    const project = await this.projectAccess.load(user, po.projectId, MODULE, 'CREATE');
    this.projectAccess.assertNotEnded(project);
    this.assertReceivable(po.status);
    const resolved = await this.resolveLines(this.prisma, user.companyId, po, input.lines);
    const id = await this.prisma.$transaction(async (tx) => {
      const number = await this.numbering.next(tx, user.companyId, DOC);
      const created = await tx.goodsReceipt.create({
        data: {
          companyId: user.companyId, number, orderId: po.id, supplierId: po.supplierId, warehouseId: po.warehouseId,
          receiptDate: input.receiptDate ?? new Date(), supplierDrNo: input.supplierDrNo ?? null, vehicle: input.vehicle ?? null,
          driver: input.driver ?? null, remarks: input.remarks ?? null, receivedById: user.id,
          lines: { create: this.lineData(resolved) },
        },
      });
      await this.audit.record(tx, {
        companyId: user.companyId, userId: user.id, entityType: DOC, entityId: created.id, action: 'CREATE',
        after: { number, orderId: po.id, orderNumber: po.number, lines: resolved.length },
      });
      return created.id;
    });
    return this.get(user, id);
  }

  async update(user: SessionUser, id: string, input: UpdateGoodsReceiptInput) {
    const preview = await this.load(user, id, 'EDIT');
    const po = await this.prisma.purchaseOrder.findUniqueOrThrow({ where: { id: preview.orderId } });
    const resolved = input.lines ? await this.resolveLines(this.prisma, user.companyId, po, input.lines) : null;
    await this.prisma.$transaction(async (tx) => {
      const before = await this.lock(tx, id);
      if (before.status !== 'DRAFT') throw new BusinessRuleError(`A ${before.status} receipt cannot be edited; only drafts can`);
      const header = { receiptDate: input.receiptDate, supplierDrNo: input.supplierDrNo, vehicle: input.vehicle, driver: input.driver, remarks: input.remarks };
      if (resolved) await tx.goodsReceiptLine.deleteMany({ where: { receiptId: id } });
      await tx.goodsReceipt.update({ where: { id }, data: { ...header, ...(resolved ? { lines: { create: this.lineData(resolved) } } : {}) } });
      await this.audit.record(tx, {
        companyId: user.companyId, userId: user.id, entityType: DOC, entityId: id, action: 'UPDATE',
        before: { receiptDate: before.receiptDate, supplierDrNo: before.supplierDrNo, vehicle: before.vehicle, driver: before.driver, remarks: before.remarks },
        after: { ...header, ...(resolved ? { lines: resolved.length } : {}) },
      });
    });
    return this.get(user, id);
  }

  /** Records (or replaces) the QC inspection of a draft receipt line. Quantities are checked again when the receipt posts. */
  async inspectDraftLine(user: SessionUser, id: string, lineId: string, input: InspectionInput) {
    await this.load(user, id, 'APPROVE');
    await this.prisma.$transaction(async (tx) => {
      const grn = await this.lock(tx, id);
      if (grn.status !== 'DRAFT') throw new BusinessRuleError('Inspections on a posted receipt must use the quarantine decision instead');
      const line = await tx.goodsReceiptLine.findFirst({ where: { id: lineId, receiptId: id }, include: { item: { select: { trackSerial: true, sku: true } } } });
      if (!line) throw new NotFoundError('Receipt line', lineId);
      const split = resolveQcSplit({
        received: line.receivedQty, dockRejected: line.rejectedQty, outcome: input.outcome,
        accepted: input.acceptedQty === undefined ? undefined : dec(input.acceptedQty),
        rejected: input.rejectedQty === undefined ? undefined : dec(input.rejectedQty),
        quarantine: input.quarantineQty === undefined ? undefined : dec(input.quarantineQty),
      });
      await tx.qcInspection.deleteMany({ where: { receiptLineId: lineId, phase: 'RECEIVING' } });
      await tx.qcInspection.create({ data: this.inspectionData(user, lineId, 'RECEIVING', input, split) });
      await this.audit.record(tx, {
        companyId: user.companyId, userId: user.id, entityType: DOC, entityId: id, action: 'QC_RECORDED',
        after: { lineId, outcome: input.outcome, accepted: split.accepted, rejected: split.rejected, quarantine: split.quarantine },
        reason: input.reason ?? undefined,
      });
    });
    return this.get(user, id);
  }

  // ---- Posting -----------------------------------------------------------------------------------

  async post(user: SessionUser, id: string, input: PostGoodsReceiptInput) {
    const preview = await this.load(user, id, 'POST');
    const wantsOverride = input.overReceipt !== undefined;
    if (wantsOverride) this.access.assertCan(user, MODULE, 'OVERRIDE', { projectId: await this.projectOf(preview.orderId), warehouseId: preview.warehouseId });

    await this.prisma.$transaction(async (tx) => {
      const grn = await this.lock(tx, id);
      if (grn.status !== 'DRAFT') throw new BusinessRuleError(`A ${grn.status} receipt cannot be posted; only drafts can`);
      // Every receipt locks the PO first, so competing receipts for the same lines queue instead of deadlocking.
      await tx.$queryRaw`SELECT id FROM "PurchaseOrder" WHERE id = ${grn.orderId} FOR UPDATE`;
      const po = await tx.purchaseOrder.findUniqueOrThrow({ where: { id: grn.orderId } });
      this.assertReceivable(po.status);
      const project = await tx.project.findUniqueOrThrow({ where: { id: po.projectId } });
      this.projectAccess.assertNotEnded(project);

      const lines = await tx.goodsReceiptLine.findMany({ where: { receiptId: id }, orderBy: { lineNo: 'asc' }, include: { inspections: true, item: true } });
      if (lines.length === 0) throw new BusinessRuleError('A receipt needs at least one line');
      const orderLines = await tx.purchaseOrderLine.findMany({ where: { orderId: po.id }, include: { item: { include: { unitConversions: true } } }, orderBy: { lineNo: 'asc' } });
      const orderLineById = new Map(orderLines.map((l) => [l.id, l]));
      const company = await tx.company.findUniqueOrThrow({ where: { id: user.companyId }, select: { overReceiptTolerancePct: true } });
      const freight = allocateFreight(orderLines.map((l) => ({ id: l.id, net: l.lineTotal })), po.freight);

      const plans = lines.map((line) => this.planLine(line, orderLineById, freight));
      const over = this.checkOverReceipt(plans, input, company.overReceiptTolerancePct);

      const movements: StockMovement[] = [];
      for (const plan of plans) {
        await this.stockLine(tx, user, grn, po, plan, movements);
      }
      await this.stock.post(tx, movements);

      for (const plan of plans) {
        await tx.goodsReceiptLine.update({
          where: { id: plan.line.id },
          data: {
            acceptedQty: plan.split.accepted, rejectedQty: plan.split.rejected, quarantineQty: plan.split.quarantine,
            quarantineOpenQty: plan.split.quarantine, qcResult: this.qcResultOf(plan.line.receivedQty, plan.split, plan.line.inspections.length > 0),
            unitCost: plan.cost.perOrderUnit, overReceivedQty: over.byLine.get(plan.line.id) ?? ZERO,
          },
        });
      }
      await this.applyReceivedToOrder(tx, po.id, plans.map((p) => ({ orderLineId: p.line.orderLineId, delta: p.net })));
      for (const plan of plans) {
        if (plan.split.accepted.plus(plan.split.quarantine).gt(0)) {
          await tx.item.update({ where: { id: plan.line.itemId }, data: { lastPurchaseCost: plan.cost.perBaseUnit } });
        }
      }
      await tx.goodsReceipt.update({
        where: { id },
        data: {
          status: 'POSTED', postedAt: new Date(),
          ...(over.total.gt(0) ? { overReceiptReason: input.overReceipt?.reason ?? null, overReceiptById: user.id } : {}),
        },
      });

      const summary = plans.map((p) => ({
        item: p.line.item.sku, received: p.line.receivedQty, accepted: p.split.accepted, rejected: p.split.rejected, quarantine: p.split.quarantine, unitCostBase: p.cost.perBaseUnit,
      }));
      await this.audit.record(tx, {
        companyId: user.companyId, userId: user.id, entityType: DOC, entityId: id, action: 'POST',
        before: { status: 'DRAFT' }, after: { status: 'POSTED', number: grn.number, orderNumber: po.number, lines: summary, overReceived: over.total },
        reason: over.total.gt(0) ? input.overReceipt?.reason : undefined,
      });
      await this.audit.record(tx, {
        companyId: user.companyId, userId: user.id, entityType: PO_DOC, entityId: po.id, action: 'RECEIPT_POSTED',
        after: { receipt: grn.number, lines: summary.length }, sourceType: DOC, sourceId: id,
      });
      if (plans.some((p) => p.split.quarantine.gt(0))) {
        await this.notifications.notifyRole('Warehouse Manager', {
          companyId: user.companyId, type: 'GRN_QUARANTINE', title: `Receipt ${grn.number} has quarantined goods awaiting a QC decision`, entityType: DOC, entityId: id,
        }, tx);
      }
      await this.notifications.notifyUsers([po.createdById], {
        companyId: user.companyId, type: 'GRN_POSTED', title: `Goods received against ${po.number} (${grn.number})`, entityType: DOC, entityId: id,
      }, tx);
    });
    return this.get(user, id);
  }

  /** QC decision on quarantined stock of a posted receipt line: release to AVAILABLE and/or reject back to the supplier. */
  async decideQuarantine(user: SessionUser, id: string, lineId: string, input: InspectionInput) {
    await this.load(user, id, 'APPROVE');
    await this.prisma.$transaction(async (tx) => {
      const grn = await this.lock(tx, id);
      if (grn.status !== 'POSTED') throw new BusinessRuleError(`A ${grn.status} receipt has no quarantined stock to decide on`);
      await tx.$queryRaw`SELECT id FROM "PurchaseOrder" WHERE id = ${grn.orderId} FOR UPDATE`;
      const po = await tx.purchaseOrder.findUniqueOrThrow({ where: { id: grn.orderId } });
      const line = await tx.goodsReceiptLine.findFirst({ where: { id: lineId, receiptId: id }, include: { item: { include: { unitConversions: true } }, orderLine: true } });
      if (!line) throw new NotFoundError('Receipt line', lineId);
      const open = line.quarantineOpenQty;
      if (open.lte(0)) throw new BusinessRuleError('This line has no quarantined quantity left to decide on');

      const split = resolveQcSplit({
        received: open, dockRejected: ZERO, outcome: input.outcome,
        accepted: input.acceptedQty === undefined ? undefined : dec(input.acceptedQty),
        rejected: input.rejectedQty === undefined ? undefined : dec(input.rejectedQty),
        quarantine: input.quarantineQty === undefined ? undefined : dec(input.quarantineQty),
      });
      if (line.item.trackSerial && input.outcome === 'PARTIAL') {
        throw new BusinessRuleError('Serialized stock is released or rejected as a whole; use PASS or FAIL');
      }
      const factor = baseUnitFactor(line.item, line.item.unitConversions, line.unit);
      const batchNo = line.batchNo;
      const base = (q: Prisma.Decimal) => toBaseQty(q, factor).toDecimalPlaces(4);
      const common = { companyId: user.companyId, txnDate: new Date(), itemId: line.itemId, warehouseId: grn.warehouseId, batchNo, locationId: line.locationId, sourceType: DOC, sourceId: id, userId: user.id, projectId: po.projectId };

      if (line.item.trackSerial) {
        await this.moveQuarantinedSerials(tx, user, line, split, common);
      } else {
        if (split.accepted.gt(0)) {
          const out = await this.stock.post(tx, [{ ...common, txnType: 'TRANSFER_OUT', stockStatus: 'QUARANTINE', qty: base(split.accepted).neg(), remarks: 'QC release' }]);
          await this.stock.post(tx, [{ ...common, txnType: 'TRANSFER_IN', stockStatus: 'AVAILABLE', qty: base(split.accepted), unitCost: out[0]?.unitCost ?? line.unitCost, remarks: 'QC release' }]);
        }
        if (split.rejected.gt(0)) {
          await this.stock.post(tx, [{ ...common, txnType: 'SUPPLIER_RETURN', stockStatus: 'QUARANTINE', qty: base(split.rejected).neg(), remarks: 'QC rejected quarantined goods' }]);
        }
      }

      await tx.qcInspection.create({ data: this.inspectionData(user, lineId, 'QUARANTINE_RELEASE', input, split) });
      const newAccepted = line.acceptedQty.plus(split.accepted);
      const newRejected = line.rejectedQty.plus(split.rejected);
      const newQuarantine = line.quarantineQty.minus(split.accepted).minus(split.rejected);
      await tx.goodsReceiptLine.update({
        where: { id: lineId },
        data: {
          acceptedQty: newAccepted, rejectedQty: newRejected, quarantineQty: newQuarantine, quarantineOpenQty: split.quarantine,
          qcResult: this.qcResultOf(line.receivedQty, { accepted: newAccepted, rejected: newRejected, quarantine: newQuarantine }, true),
        },
      });
      // Goods sent back to the supplier are no longer "received": that quantity becomes open on the PO again.
      if (split.rejected.gt(0)) await this.applyReceivedToOrder(tx, po.id, [{ orderLineId: line.orderLineId, delta: split.rejected.neg() }]);
      await this.audit.record(tx, {
        companyId: user.companyId, userId: user.id, entityType: DOC, entityId: id, action: 'QC_QUARANTINE_DECISION',
        after: { lineId, outcome: input.outcome, released: split.accepted, rejected: split.rejected, stillQuarantined: split.quarantine },
        reason: input.reason ?? undefined,
      });
    });
    return this.get(user, id);
  }

  // ---- Cancel / reverse ----------------------------------------------------------------------------

  async cancel(user: SessionUser, id: string, reason: string) {
    await this.load(user, id, 'CANCEL');
    await this.prisma.$transaction(async (tx) => {
      const grn = await this.lock(tx, id);
      if (grn.status === 'CANCELLED') throw new BusinessRuleError('This receipt is already cancelled');
      if (grn.status === 'DRAFT') {
        await tx.goodsReceipt.update({ where: { id }, data: { status: 'CANCELLED', cancelledAt: new Date(), cancelReason: reason } });
        await this.audit.record(tx, {
          companyId: user.companyId, userId: user.id, entityType: DOC, entityId: id, action: 'CANCEL',
          before: { status: 'DRAFT' }, after: { status: 'CANCELLED' }, reason,
        });
        return;
      }
      await tx.$queryRaw`SELECT id FROM "PurchaseOrder" WHERE id = ${grn.orderId} FOR UPDATE`;
      const po = await tx.purchaseOrder.findUniqueOrThrow({ where: { id: grn.orderId } });
      if (po.status === 'CLOSED' || po.status === 'CANCELLED') {
        throw new BusinessRuleError(`The purchase order is ${po.status.toLowerCase()}; a receipt against it can no longer be reversed`);
      }
      const lines = await tx.goodsReceiptLine.findMany({ where: { receiptId: id }, include: { item: true } });
      await this.assertNotConsumed(tx, user.companyId, id, lines);

      await this.stock.reverse(tx, { companyId: user.companyId, sourceType: DOC, sourceId: id, userId: user.id, reason });
      await tx.serialUnit.deleteMany({
        where: { companyId: user.companyId, OR: lines.filter((l) => l.serialNos.length > 0).map((l) => ({ itemId: l.itemId, serialNo: { in: l.serialNos } })) },
      });
      await this.applyReceivedToOrder(tx, po.id, lines.map((l) => ({ orderLineId: l.orderLineId, delta: l.acceptedQty.plus(l.quarantineQty).neg() })));
      await tx.goodsReceipt.update({ where: { id }, data: { status: 'CANCELLED', cancelledAt: new Date(), cancelReason: reason } });
      await this.audit.record(tx, {
        companyId: user.companyId, userId: user.id, entityType: DOC, entityId: id, action: 'REVERSE',
        before: { status: 'POSTED' }, after: { status: 'CANCELLED', number: grn.number }, reason,
      });
      await this.audit.record(tx, {
        companyId: user.companyId, userId: user.id, entityType: PO_DOC, entityId: po.id, action: 'RECEIPT_REVERSED',
        after: { receipt: grn.number }, reason, sourceType: DOC, sourceId: id,
      });
    });
    return this.get(user, id);
  }

  // ---- helpers: posting --------------------------------------------------------------------------

  private planLine(
    line: Prisma.GoodsReceiptLineGetPayload<{ include: { inspections: true; item: true } }>,
    orderLineById: Map<string, Prisma.PurchaseOrderLineGetPayload<{ include: { item: { include: { unitConversions: true } } } }>>,
    freight: Map<string, Prisma.Decimal>,
  ) {
    const orderLine = orderLineById.get(line.orderLineId);
    if (!orderLine) throw new BusinessRuleError('A receipt line no longer matches a line of the purchase order');
    const insp = line.inspections.find((i) => i.phase === 'RECEIVING');
    const split = insp
      ? resolveQcSplit({ received: line.receivedQty, dockRejected: line.rejectedQty, outcome: 'PARTIAL', accepted: insp.acceptedQty, rejected: insp.rejectedQty, quarantine: insp.quarantineQty })
      : resolveQcSplit({ received: line.receivedQty, dockRejected: line.rejectedQty, outcome: null });
    if (split.accepted.lt(0)) throw new BusinessRuleError(`Rejected quantity exceeds the quantity received for ${line.item.sku}`);
    const factor = baseUnitFactor(orderLine.item, orderLine.item.unitConversions, orderLine.unit);
    const cost = landedUnitCost({ lineNet: orderLine.lineTotal, freightShare: freight.get(orderLine.id) ?? ZERO, orderedQty: orderLine.qty, baseFactor: factor });
    return { line, orderLine, split, factor, cost, net: split.accepted.plus(split.quarantine) };
  }

  private checkOverReceipt(plans: Array<ReturnType<GoodsReceiptsService['planLine']>>, input: PostGoodsReceiptInput, tolerancePct: Prisma.Decimal) {
    const netByOrderLine = new Map<string, Prisma.Decimal>();
    for (const p of plans) netByOrderLine.set(p.orderLine.id, (netByOrderLine.get(p.orderLine.id) ?? ZERO).plus(p.net));
    const byLine = new Map<string, Prisma.Decimal>();
    let total = ZERO;
    const remainingOver = new Map<string, Prisma.Decimal>();
    for (const [orderLineId, net] of netByOrderLine) {
      const orderLine = plans.find((p) => p.orderLine.id === orderLineId)!.orderLine;
      const open = nonNegative(orderLine.qty.minus(orderLine.receivedQty).minus(orderLine.cancelledQty));
      const excess = nonNegative(net.minus(open));
      if (excess.isZero()) continue;
      if (!input.overReceipt) {
        throw new BusinessRuleError(
          `Receiving ${net} of ${orderLine.item.sku} exceeds the ${open} still open on the purchase order. Over-receipt needs an authorised override with a reason.`,
          [{ path: 'overReceipt', message: 'Over-receipt override required' }],
        );
      }
      const limit = open.mul(dec(100).plus(tolerancePct)).div(100);
      if (net.gt(limit)) {
        throw new BusinessRuleError(
          `Receiving ${net} of ${orderLine.item.sku} exceeds the ${open} open by more than the ${tolerancePct}% tolerance (maximum ${limit.toDecimalPlaces(4)}).`,
        );
      }
      total = total.plus(excess);
      remainingOver.set(orderLineId, excess);
    }
    for (const p of plans) {
      const left = remainingOver.get(p.orderLine.id);
      if (!left || left.isZero()) continue;
      const share = Prisma.Decimal.min(left, p.net);
      byLine.set(p.line.id, share);
      remainingOver.set(p.orderLine.id, left.minus(share));
    }
    return { total, byLine };
  }

  /** Writes ledger movements, batch and serial records for one line (nothing is written for rejected units). */
  private async stockLine(
    tx: Db,
    user: SessionUser,
    grn: { id: string; warehouseId: string; supplierId: string; receiptDate: Date },
    po: { id: string; projectId: string },
    plan: ReturnType<GoodsReceiptsService['planLine']>,
    movements: StockMovement[],
  ): Promise<void> {
    const { line, orderLine, split, factor, cost } = plan;
    if (line.batchNo) await this.upsertBatch(tx, user.companyId, line.itemId, line.batchNo, grn.supplierId, line.expiryDate);
    const common = {
      companyId: user.companyId, txnDate: grn.receiptDate, txnType: 'PURCHASE_RECEIPT' as const, warehouseId: grn.warehouseId, locationId: line.locationId,
      itemId: line.itemId, batchNo: line.batchNo, unitCost: cost.perBaseUnit, sourceType: DOC, sourceId: grn.id, projectId: po.projectId,
      wbsNodeId: orderLine.wbsNodeId, costCodeId: orderLine.costCodeId, boqItemId: orderLine.boqItemId, userId: user.id,
    };
    if (line.item.trackSerial) {
      const accepted = line.serialNos.slice(0, split.accepted.toNumber());
      const quarantined = line.serialNos.slice(split.accepted.toNumber(), split.accepted.plus(split.quarantine).toNumber());
      await this.assertSerialsFree(tx, user.companyId, line.itemId, [...accepted, ...quarantined]);
      for (const [serials, status] of [[accepted, 'AVAILABLE'], [quarantined, 'QUARANTINE']] as const) {
        for (const serialNo of serials) {
          movements.push({ ...common, stockStatus: status, serialNo, qty: toBaseQty(dec(1), factor).toDecimalPlaces(4) });
          await tx.serialUnit.create({
            data: { companyId: user.companyId, itemId: line.itemId, serialNo, status: 'IN_STOCK', warehouseId: grn.warehouseId, condition: status === 'QUARANTINE' ? 'QUARANTINE' : 'GOOD' },
          });
        }
      }
      return;
    }
    if (split.accepted.gt(0)) movements.push({ ...common, stockStatus: 'AVAILABLE', qty: toBaseQty(split.accepted, factor).toDecimalPlaces(4) });
    if (split.quarantine.gt(0)) movements.push({ ...common, stockStatus: 'QUARANTINE', qty: toBaseQty(split.quarantine, factor).toDecimalPlaces(4) });
  }

  private async moveQuarantinedSerials(
    tx: Db,
    user: SessionUser,
    line: { id: string; itemId: string; serialNos: string[]; unit: string; acceptedQty: Prisma.Decimal; quarantineOpenQty: Prisma.Decimal; unitCost: Prisma.Decimal; item: { baseUnit: string; purchaseUnit: string | null; issueUnit: string | null; conversionFactor: Prisma.Decimal; unitConversions: Array<{ unit: string; factor: Prisma.Decimal }> } },
    split: { accepted: Prisma.Decimal; rejected: Prisma.Decimal },
    common: Omit<StockMovement, 'txnType' | 'qty'>,
  ): Promise<void> {
    const held = await tx.serialUnit.findMany({
      where: { companyId: user.companyId, itemId: line.itemId, serialNo: { in: line.serialNos }, condition: 'QUARANTINE', status: 'IN_STOCK' },
      orderBy: { serialNo: 'asc' },
    });
    if (held.length === 0) throw new BusinessRuleError('No quarantined serial units are left for this line');
    const factor = baseUnitFactor(line.item, line.item.unitConversions, line.unit);
    for (const unit of held) {
      const one = toBaseQty(dec(1), factor).toDecimalPlaces(4);
      if (split.accepted.gt(0)) {
        const out = await this.stock.post(tx, [{ ...common, serialNo: unit.serialNo, txnType: 'TRANSFER_OUT', stockStatus: 'QUARANTINE', qty: one.neg(), remarks: 'QC release' }]);
        await this.stock.post(tx, [{ ...common, serialNo: unit.serialNo, txnType: 'TRANSFER_IN', stockStatus: 'AVAILABLE', qty: one, unitCost: out[0]?.unitCost ?? line.unitCost, remarks: 'QC release' }]);
        await tx.serialUnit.update({ where: { id: unit.id }, data: { condition: 'GOOD' } });
      } else {
        await this.stock.post(tx, [{ ...common, serialNo: unit.serialNo, txnType: 'SUPPLIER_RETURN', stockStatus: 'QUARANTINE', qty: one.neg(), remarks: 'QC rejected quarantined goods' }]);
        await tx.serialUnit.delete({ where: { id: unit.id } });
      }
    }
  }

  private async upsertBatch(tx: Db, companyId: string, itemId: string, batchNo: string, supplierId: string, expiryDate: Date | null): Promise<void> {
    const existing = await tx.batchRecord.findUnique({ where: { companyId_itemId_batchNo: { companyId, itemId, batchNo } } });
    if (!existing) {
      await tx.batchRecord.create({ data: { companyId, itemId, batchNo, supplierId, expiryDate } });
      return;
    }
    if (expiryDate && existing.expiryDate && existing.expiryDate.getTime() !== expiryDate.getTime()) {
      throw new BusinessRuleError(`Batch ${batchNo} already exists with a different expiry date (${existing.expiryDate.toISOString().slice(0, 10)})`);
    }
    if (expiryDate && !existing.expiryDate) await tx.batchRecord.update({ where: { id: existing.id }, data: { expiryDate } });
  }

  private async assertSerialsFree(tx: Db, companyId: string, itemId: string, serials: string[]): Promise<void> {
    const dup = serials.filter((s, i) => serials.indexOf(s) !== i);
    if (dup.length > 0) throw new BusinessRuleError(`Serial number(s) listed twice: ${dup.join(', ')}`);
    const taken = await tx.serialUnit.findMany({ where: { companyId, itemId, serialNo: { in: serials } }, select: { serialNo: true } });
    if (taken.length > 0) throw new BusinessRuleError(`Serial number(s) already exist for this item: ${taken.map((t) => t.serialNo).join(', ')}`);
  }

  /** Recomputes received quantities on PO lines and the PO status from the resulting quantities. */
  private async applyReceivedToOrder(tx: Db, orderId: string, deltas: Array<{ orderLineId: string; delta: Prisma.Decimal }>): Promise<void> {
    const byLine = new Map<string, Prisma.Decimal>();
    for (const d of deltas) byLine.set(d.orderLineId, (byLine.get(d.orderLineId) ?? ZERO).plus(d.delta));
    for (const [orderLineId, delta] of [...byLine].sort(([a], [b]) => a.localeCompare(b))) {
      if (delta.isZero()) continue;
      await tx.purchaseOrderLine.update({ where: { id: orderLineId }, data: { receivedQty: { increment: delta } } });
    }
    const lines = await tx.purchaseOrderLine.findMany({ where: { orderId }, select: { qty: true, receivedQty: true, cancelledQty: true } });
    const po = await tx.purchaseOrder.findUniqueOrThrow({ where: { id: orderId }, select: { status: true, sentAt: true } });
    if (po.status === 'CLOSED' || po.status === 'CANCELLED') return;
    const anyReceived = lines.some((l) => l.receivedQty.gt(0));
    const complete = lines.every((l) => l.qty.minus(l.cancelledQty).minus(l.receivedQty).lte(0));
    const next = !anyReceived ? (po.sentAt ? 'SENT' : 'APPROVED') : complete ? 'RECEIVED' : 'PARTIALLY_RECEIVED';
    if (next !== po.status) {
      await tx.purchaseOrder.update({ where: { id: orderId }, data: { status: next } });
      await this.audit.record(tx, {
        companyId: (await tx.purchaseOrder.findUniqueOrThrow({ where: { id: orderId }, select: { companyId: true } })).companyId,
        userId: null, entityType: PO_DOC, entityId: orderId, action: 'STATUS_CHANGE', before: { status: po.status }, after: { status: next },
      });
    }
  }

  /** A receipt can only be reversed while every unit it stocked is still on hand and in stock. */
  private async assertNotConsumed(tx: Db, companyId: string, receiptId: string, lines: Array<{ itemId: string; serialNos: string[] }>): Promise<void> {
    const rows = await tx.stockLedger.findMany({
      where: { companyId, sourceType: DOC, sourceId: receiptId, txnType: { not: 'REVERSAL' }, reversedBy: { none: {} } },
      select: { warehouseId: true, itemId: true, batchNo: true, stockStatus: true, qty: true, item: { select: { sku: true } } },
    });
    const net = new Map<string, { qty: Prisma.Decimal; row: (typeof rows)[number] }>();
    for (const r of rows) {
      const key = `${r.warehouseId}|${r.itemId}|${r.batchNo}|${r.stockStatus}`;
      net.set(key, { qty: (net.get(key)?.qty ?? ZERO).plus(r.qty), row: r });
    }
    for (const { qty, row } of net.values()) {
      if (qty.lte(0)) continue;
      const bucket = await tx.stockBalance.findUnique({
        where: { warehouseId_itemId_batchNo_stockStatus: { warehouseId: row.warehouseId, itemId: row.itemId, batchNo: row.batchNo, stockStatus: row.stockStatus } },
      });
      if ((bucket?.qtyOnHand ?? ZERO).lt(qty)) {
        throw new BusinessRuleError(`Cannot reverse: stock of ${row.item.sku} from this receipt has already been used or moved (${qty} to take back, ${bucket?.qtyOnHand ?? 0} on hand)`);
      }
    }
    for (const l of lines.filter((x) => x.serialNos.length > 0)) {
      const out = await tx.serialUnit.count({ where: { companyId, itemId: l.itemId, serialNo: { in: l.serialNos }, status: { not: 'IN_STOCK' } } });
      if (out > 0) throw new BusinessRuleError('Cannot reverse: some serial units from this receipt have already been issued');
    }
  }

  // ---- helpers: lines ----------------------------------------------------------------------------

  private async resolveLines(db: Db, companyId: string, po: { id: string; warehouseId: string }, inputs: GoodsReceiptLineInput[]): Promise<ResolvedLine[]> {
    const orderLines = await db.purchaseOrderLine.findMany({
      where: { orderId: po.id, id: { in: inputs.map((l) => l.orderLineId) } },
      include: { item: { include: { unitConversions: true } } },
    });
    const byId = new Map(orderLines.map((l) => [l.id, l]));
    const locationIds = [...new Set(inputs.flatMap((l) => (l.locationId ? [l.locationId] : [])))];
    const locations = locationIds.length
      ? await db.warehouseLocation.findMany({ where: { id: { in: locationIds }, companyId, warehouseId: po.warehouseId, deletedAt: null, active: true }, select: { id: true } })
      : [];
    const okLocations = new Set(locations.map((l) => l.id));

    const issues: Array<{ path: string; message: string }> = [];
    const resolved: ResolvedLine[] = [];
    inputs.forEach((input, i) => {
      const at = (f: string) => `lines.${i}.${f}`;
      const orderLine = byId.get(input.orderLineId);
      if (!orderLine) {
        issues.push({ path: at('orderLineId'), message: 'Line does not belong to this purchase order' });
        return;
      }
      const item = orderLine.item;
      const received = dec(input.receivedQty);
      const rejected = dec(input.rejectedQty ?? 0);
      if (rejected.gt(received)) issues.push({ path: at('rejectedQty'), message: 'Rejected quantity cannot exceed the quantity received' });
      if (input.locationId && !okLocations.has(input.locationId)) issues.push({ path: at('locationId'), message: 'Location does not belong to the receiving warehouse' });
      if (item.trackBatch && !input.batchNo) issues.push({ path: at('batchNo'), message: `${item.sku} is batch-controlled: batch number required` });
      if (!item.trackBatch && input.batchNo) issues.push({ path: at('batchNo'), message: `${item.sku} is not batch-controlled` });
      if (item.trackExpiry && !input.expiryDate) issues.push({ path: at('expiryDate'), message: `${item.sku} tracks expiry: expiry date required` });
      if (!item.trackExpiry && input.expiryDate) issues.push({ path: at('expiryDate'), message: `${item.sku} does not track expiry` });
      if (item.trackSerial) {
        const serials = input.serialNos ?? [];
        if (!received.isInteger()) issues.push({ path: at('receivedQty'), message: `${item.sku} is serialized: quantity must be a whole number` });
        else if (serials.length !== received.toNumber()) issues.push({ path: at('serialNos'), message: `${item.sku} is serialized: provide exactly ${received} serial number(s), one per unit` });
        if (new Set(serials).size !== serials.length) issues.push({ path: at('serialNos'), message: 'Serial numbers must be unique' });
      } else if ((input.serialNos ?? []).length > 0) {
        issues.push({ path: at('serialNos'), message: `${item.sku} is not serialized` });
      }
      resolved.push({ input, orderLine });
    });
    if (issues.length > 0) throw new BusinessRuleError('One or more receipt lines are invalid', issues);
    return resolved;
  }

  private lineData(lines: ResolvedLine[]): Prisma.GoodsReceiptLineUncheckedCreateWithoutReceiptInput[] {
    return lines.map((l, i) => ({
      lineNo: i + 1, orderLineId: l.orderLine.id, itemId: l.orderLine.itemId, receivedQty: l.input.receivedQty, rejectedQty: l.input.rejectedQty ?? 0,
      rejectionReason: l.input.rejectionReason ?? null, unit: l.orderLine.unit, unitCost: l.orderLine.unitPrice, batchNo: l.input.batchNo ?? '',
      expiryDate: l.input.expiryDate ?? null, locationId: l.input.locationId ?? null, serialNos: l.input.serialNos ?? [],
    }));
  }

  private inspectionData(user: SessionUser, receiptLineId: string, phase: string, input: InspectionInput, split: { accepted: Prisma.Decimal; rejected: Prisma.Decimal; quarantine: Prisma.Decimal }): Prisma.QcInspectionUncheckedCreateInput {
    const result = input.outcome === 'PASS' ? 'ACCEPTED' : input.outcome === 'FAIL' ? 'REJECTED' : split.quarantine.gt(0) && split.accepted.isZero() && split.rejected.isZero() ? 'QUARANTINED' : 'PARTIAL';
    return {
      companyId: user.companyId, receiptLineId, inspectorId: user.id, result, outcome: input.outcome, phase,
      acceptedQty: split.accepted, rejectedQty: split.rejected, quarantineQty: split.quarantine, reason: input.reason ?? null,
      remarks: input.remarks ?? null, testResult: input.testResult ?? null, certificateNo: input.certificateNo ?? null,
      checklist: input.checklist ? (input.checklist as unknown as Prisma.InputJsonValue) : undefined,
      attachments: input.attachments ? (input.attachments as unknown as Prisma.InputJsonValue) : undefined,
    };
  }

  private qcResultOf(received: Prisma.Decimal, split: { accepted: Prisma.Decimal; rejected: Prisma.Decimal; quarantine: Prisma.Decimal }, inspected: boolean): 'ACCEPTED' | 'REJECTED' | 'QUARANTINED' | 'PARTIAL' | 'PENDING' {
    if (!inspected && split.rejected.isZero() && split.quarantine.isZero()) return 'ACCEPTED';
    if (split.accepted.equals(received)) return 'ACCEPTED';
    if (split.rejected.equals(received)) return 'REJECTED';
    if (split.quarantine.equals(received)) return 'QUARANTINED';
    return 'PARTIAL';
  }

  /** Posted quantity (accepted + quarantined) already received before this receipt, per PO line. */
  private async postedBefore(grn: { id: string; orderId: string; postedAt: Date | null; status: string }, lines: LineWithRefs[]): Promise<Map<string, Prisma.Decimal>> {
    const out = new Map<string, Prisma.Decimal>();
    if (grn.status !== 'POSTED' || !grn.postedAt) {
      for (const l of lines) out.set(l.orderLineId, l.orderLine.receivedQty);
      return out;
    }
    const others = await this.prisma.goodsReceiptLine.groupBy({
      by: ['orderLineId'],
      where: { orderLineId: { in: lines.map((l) => l.orderLineId) }, receipt: { orderId: grn.orderId, status: 'POSTED', id: { not: grn.id }, postedAt: { lt: grn.postedAt } } },
      _sum: { acceptedQty: true, quarantineQty: true },
    });
    for (const o of others) out.set(o.orderLineId, (o._sum.acceptedQty ?? ZERO).plus(o._sum.quarantineQty ?? ZERO));
    return out;
  }

  private lineView(status: string, l: LineWithRefs, previouslyReceived: Prisma.Decimal) {
    const { orderLine, ...line } = l;
    const posted = status === 'POSTED';
    const open = nonNegative(orderLine.qty.minus(orderLine.cancelledQty).minus(previouslyReceived));
    const receivingNow = posted ? l.acceptedQty.plus(l.quarantineQty) : l.receivedQty.minus(l.rejectedQty);
    return {
      ...line,
      ordered: orderLine.qty.toString(),
      previouslyReceived: previouslyReceived.toString(),
      remaining: (posted ? nonNegative(open.minus(receivingNow)) : open).toString(),
      receivingNow: receivingNow.toString(),
      overReceiving: !posted && receivingNow.gt(open),
    };
  }

  // ---- helpers: loading ---------------------------------------------------------------------------

  private assertReceivable(status: string): void {
    if (!RECEIVABLE_PO.includes(status)) {
      throw new BusinessRuleError(`Goods can only be received against an approved, sent or part-received purchase order (this one is ${status})`);
    }
  }

  private async projectOf(orderId: string): Promise<string> {
    return (await this.prisma.purchaseOrder.findUniqueOrThrow({ where: { id: orderId }, select: { projectId: true } })).projectId;
  }

  private async loadOrder(user: SessionUser, orderId: string, action: Action) {
    const po = await this.prisma.purchaseOrder.findFirst({ where: { id: orderId, companyId: user.companyId, deletedAt: null } });
    if (!po) throw new NotFoundError('Purchase order', orderId);
    this.access.assertCan(user, MODULE, action, { projectId: po.projectId, warehouseId: po.warehouseId });
    return po;
  }

  private async load(user: SessionUser, id: string, action: Action) {
    const grn = await this.prisma.goodsReceipt.findFirst({ where: { id, companyId: user.companyId, deletedAt: null }, include: { order: { select: { projectId: true } } } });
    if (!grn) throw new NotFoundError('Goods receipt', id);
    this.access.assertCan(user, MODULE, action, { projectId: grn.order.projectId, warehouseId: grn.warehouseId });
    const { order: _order, ...plain } = grn;
    return plain;
  }

  private async lock(tx: Db, id: string) {
    await tx.$queryRaw`SELECT id FROM "GoodsReceipt" WHERE id = ${id} FOR UPDATE`;
    return tx.goodsReceipt.findUniqueOrThrow({ where: { id } });
  }
}
