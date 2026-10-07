import { Injectable, OnModuleInit } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PO_SORT_FIELDS } from '@probuild/shared';
import type { CreatePurchaseOrderInput, PurchaseOrderListQuery, SessionUser, UpdatePurchaseOrderInput } from '@probuild/shared';
import { AccessService } from '../../common/access.service';
import { AuditedService } from '../../common/audited-service';
import { BusinessRuleError, NotFoundError } from '../../common/errors/domain-errors';
import { buildOrderBy, containsAny, dateRange } from '../../common/list';
import { computeLine, dec, nonNegative, round2, sumLines, ZERO } from '../../common/money';
import { paginate } from '../../common/pagination';
import { ProjectAccessService } from '../../common/project-access.service';
import { ActivityService } from '../../engines/activity/activity.service';
import { ApprovalsService } from '../../engines/approvals/approvals.service';
import { AuditService } from '../../engines/audit/audit.service';
import { NotificationsService } from '../../engines/notifications/notifications.service';
import { NumberingService } from '../../engines/numbering/numbering.service';
import { Db, PrismaService } from '../../prisma/prisma.service';
import { ProcurementValidator } from './procurement-validation';
import { refreshRequisitionOrdering, releaseRequisitionQty, reserveRequisitionQty } from './requisition-ordering';

const DOC = 'PURCHASE_ORDER';
const MODULE = 'procurement.order';
const ORDERABLE_PR = ['APPROVED', 'PARTIALLY_ORDERED'];
type Meta = { ip?: string; userAgent?: string };

/** The create schema already guarantees these per source; this narrows the types without non-null assertions. */
function required<T>(value: T | undefined, name: string): T {
  if (value === undefined) throw new BusinessRuleError(`${name} is required`, [{ path: name, message: `${name} is required` }]);
  return value;
}

type LineDraft = {
  requisitionLineId: string;
  quotationLineId: string | null;
  itemId: string;
  description: string | null;
  unit: string;
  qty: Prisma.Decimal;
  unitPrice: Prisma.Decimal | string;
  discountPct: string;
  taxPct: string;
  deliveryDate: Date | null;
  wbsNodeId: string | null;
  costCodeId: string | null;
  boqItemId: string | null;
};

const LINE_INCLUDE = {
  item: { select: { id: true, sku: true, name: true, baseUnit: true } },
  wbsNode: { select: { id: true, code: true, name: true } },
  costCode: { select: { id: true, code: true, name: true } },
  boqItem: { select: { id: true, itemNo: true, description: true } },
} satisfies Prisma.PurchaseOrderLineInclude;

/**
 * Purchase order workflow:
 *   DRAFT -> PENDING_APPROVAL -> APPROVED | REJECTED  (no workflow for the amount => DRAFT -> APPROVED)
 *   APPROVED -> SENT -> (PARTIALLY_RECEIVED | RECEIVED, driven by goods receipts) -> CLOSED
 *   DRAFT | PENDING_APPROVAL | APPROVED | SENT -> CANCELLED (only while nothing has been received)
 *   SENT | PARTIALLY_RECEIVED | RECEIVED -> CLOSED (unreceived remainder is cancelled)
 * Quantities: a draft PO reserves requisition quantity immediately; cancel / reject / close release the
 * part that will never arrive and record it in PurchaseOrderLine.cancelledQty.
 */
@Injectable()
export class PurchaseOrdersService extends AuditedService implements OnModuleInit {
  constructor(
    prisma: PrismaService,
    audit: AuditService,
    private readonly access: AccessService,
    private readonly projectAccess: ProjectAccessService,
    private readonly approvals: ApprovalsService,
    private readonly notifications: NotificationsService,
    private readonly numbering: NumberingService,
    private readonly activity: ActivityService,
    private readonly validator: ProcurementValidator,
  ) {
    super(prisma, audit);
  }

  onModuleInit(): void {
    this.approvals.registerHandler(DOC, {
      onApproved: async (db, request) => {
        const moved = await db.purchaseOrder.updateMany({
          where: { id: request.documentId, companyId: request.companyId, status: 'PENDING_APPROVAL' },
          data: { status: 'APPROVED', approvedAt: new Date() },
        });
        if (!(await this.settledOrMissing(db, request.documentId, request.companyId, moved.count))) return;
        await this.audit.record(db, {
          companyId: request.companyId, userId: null, entityType: DOC, entityId: request.documentId,
          action: 'STATUS_CHANGE', before: { status: 'PENDING_APPROVAL' }, after: { status: 'APPROVED' },
        });
      },
      onRejected: async (db, request) => {
        const moved = await db.purchaseOrder.updateMany({
          where: { id: request.documentId, companyId: request.companyId, status: 'PENDING_APPROVAL' },
          data: { status: 'REJECTED', rejectedAt: new Date() },
        });
        if (!(await this.settledOrMissing(db, request.documentId, request.companyId, moved.count))) return;
        await this.releaseAll(db, request.documentId);
        await this.audit.record(db, {
          companyId: request.companyId, userId: null, entityType: DOC, entityId: request.documentId,
          action: 'STATUS_CHANGE', before: { status: 'PENDING_APPROVAL' }, after: { status: 'REJECTED' },
        });
      },
    });
  }

  /**
   * An approval decision must only move a document that is still awaiting it. A decision for a document id
   * that no longer exists (nothing to move) is a no-op; one for a document in any other state fails the decision.
   */
  private async settledOrMissing(db: Db, id: string, companyId: string, moved: number): Promise<boolean> {
    if (moved === 1) return true;
    const doc = await db.purchaseOrder.findFirst({ where: { id, companyId }, select: { status: true } });
    if (!doc) return false;
    throw new BusinessRuleError('The purchase order is no longer awaiting approval');
  }

  // ---- Queries -----------------------------------------------------------------------------------

  list(user: SessionUser, query: PurchaseOrderListQuery) {
    const where: Prisma.PurchaseOrderWhereInput = {
      companyId: user.companyId,
      deletedAt: null,
      ...this.access.projectWhere(user, MODULE, 'VIEW'),
      ...(query.projectId ? { projectId: query.projectId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.supplierId ? { supplierId: query.supplierId } : {}),
      ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
      ...(query.requisitionId ? { requisitionId: query.requisitionId } : {}),
      ...(dateRange(query.from, query.to) ? { orderDate: dateRange(query.from, query.to) } : {}),
      ...containsAny(query.search, ['number', 'terms']),
    };
    return paginate(
      (args) =>
        this.prisma.purchaseOrder.findMany({
          where,
          orderBy: buildOrderBy(query.sort, PO_SORT_FIELDS, [{ createdAt: 'desc' }]),
          include: {
            supplier: { select: { id: true, code: true, name: true } },
            project: { select: { id: true, code: true, name: true } },
            warehouse: { select: { id: true, code: true, name: true } },
            _count: { select: { lines: true } },
          },
          ...args,
        }),
      query,
    );
  }

  /** The business-document view: header, lines, receipts, approvals and a recent activity slice. */
  async get(user: SessionUser, id: string) {
    const po = await this.load(user, id, 'VIEW');
    const [supplier, project, warehouse, lines, receipts, approvals, activity, requisition, rfq] = await Promise.all([
      this.prisma.supplier.findUniqueOrThrow({ where: { id: po.supplierId }, select: { id: true, code: true, name: true, tin: true, paymentTermsDays: true } }),
      this.prisma.project.findUniqueOrThrow({ where: { id: po.projectId }, select: { id: true, code: true, name: true } }),
      this.prisma.warehouse.findUniqueOrThrow({ where: { id: po.warehouseId }, select: { id: true, code: true, name: true } }),
      this.prisma.purchaseOrderLine.findMany({ where: { orderId: id }, orderBy: { lineNo: 'asc' }, include: LINE_INCLUDE }),
      this.prisma.goodsReceipt.findMany({
        where: { orderId: id, companyId: user.companyId, deletedAt: null },
        orderBy: { receiptDate: 'asc' },
        select: { id: true, number: true, status: true, receiptDate: true, postedAt: true },
      }),
      this.activity.approvalsFor(user.companyId, DOC, id),
      this.activity.forDocument({ companyId: user.companyId, entityType: DOC, entityId: id, approvalType: DOC, limit: 100 }),
      po.requisitionId ? this.prisma.purchaseRequisition.findUnique({ where: { id: po.requisitionId }, select: { id: true, number: true, status: true } }) : Promise.resolve(null),
      po.rfqId ? this.prisma.rfq.findUnique({ where: { id: po.rfqId }, select: { id: true, number: true, status: true } }) : Promise.resolve(null),
    ]);
    return {
      ...po,
      supplier,
      project,
      warehouse,
      requisition,
      rfq,
      lines: lines.map((l) => ({ ...l, openQty: nonNegative(l.qty.minus(l.receivedQty).minus(l.cancelledQty)).toString() })),
      receipts,
      approvals,
      activity,
    };
  }

  async activityFor(user: SessionUser, id: string) {
    await this.load(user, id, 'VIEW');
    return this.activity.forDocument({ companyId: user.companyId, entityType: DOC, entityId: id, approvalType: DOC });
  }

  // ---- Create / edit -----------------------------------------------------------------------------

  async create(user: SessionUser, input: CreatePurchaseOrderInput) {
    const source =
      input.source === 'QUOTATION'
        ? await this.fromQuotation(user, required(input.quotationId, 'quotationId'))
        : await this.fromRequisition(user, required(input.requisitionId, 'requisitionId'), required(input.supplierId, 'supplierId'), required(input.lines, 'lines'));
    const { requisition, supplierId, lines } = source;

    const project = await this.projectAccess.load(user, requisition.projectId, MODULE, 'CREATE');
    this.projectAccess.assertActive(project);
    await this.validator.assertSupplierUsable(this.prisma, user.companyId, supplierId);
    const warehouseId = input.warehouseId ?? requisition.warehouseId;
    if (!warehouseId) throw new BusinessRuleError('A delivery warehouse is required', [{ path: 'warehouseId', message: 'warehouseId is required' }]);
    await this.validator.assertWarehouse(this.prisma, user.companyId, warehouseId);

    const priced = lines.map((l) => ({ draft: l, money: computeLine({ qty: l.qty, unitPrice: l.unitPrice, discountPct: l.discountPct, taxPct: l.taxPct }) }));
    const freight = input.freight ?? source.freight;
    const totals = sumLines(priced.map((p) => p.money), freight);
    const expected = input.expectedDate === undefined ? this.latestDelivery(lines) : input.expectedDate;

    const id = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "PurchaseRequisition" WHERE id = ${requisition.id} FOR UPDATE`;
      const pr = await tx.purchaseRequisition.findUniqueOrThrow({ where: { id: requisition.id } });
      if (!ORDERABLE_PR.includes(pr.status)) {
        throw new BusinessRuleError(`Purchase orders can only be raised from an approved requisition (this one is ${pr.status})`);
      }
      const number = await this.numbering.next(tx, user.companyId, DOC);
      const po = await tx.purchaseOrder.create({
        data: {
          companyId: user.companyId, number, supplierId, projectId: pr.projectId, warehouseId,
          requisitionId: pr.id, quotationId: source.quotationId, rfqId: source.rfqId,
          orderDate: input.orderDate ?? new Date(), expectedDate: expected,
          deliveryLocation: input.deliveryLocation ?? null,
          paymentTerms: input.paymentTerms === undefined ? source.paymentTerms : input.paymentTerms,
          terms: input.terms ?? null, currency: source.currency, createdById: user.id,
          subtotal: totals.subtotal, discount: totals.discount, freight: totals.freight, taxAmount: totals.tax, totalAmount: totals.total,
          lines: {
            create: priced.map((p, i) => ({
              lineNo: i + 1, itemId: p.draft.itemId, description: p.draft.description, requisitionLineId: p.draft.requisitionLineId,
              quotationLineId: p.draft.quotationLineId, wbsNodeId: p.draft.wbsNodeId, costCodeId: p.draft.costCodeId, boqItemId: p.draft.boqItemId,
              qty: p.draft.qty, unit: p.draft.unit, unitPrice: p.draft.unitPrice, discountPct: p.draft.discountPct, taxPct: p.draft.taxPct,
              discountAmount: p.money.discount, taxAmount: p.money.tax, lineTotal: p.money.net, deliveryDate: p.draft.deliveryDate,
            })),
          },
        },
      });
      // Sorted so concurrent POs touching the same lines always lock them in the same order.
      const reservations = [...priced].sort((a, b) => a.draft.requisitionLineId.localeCompare(b.draft.requisitionLineId));
      for (const r of reservations) await reserveRequisitionQty(tx, r.draft.requisitionLineId, dec(r.draft.qty), `lines.${priced.indexOf(r)}.qty`);
      await refreshRequisitionOrdering(tx, pr.id);
      await this.audit.record(tx, {
        companyId: user.companyId, userId: user.id, entityType: DOC, entityId: po.id, action: 'CREATE',
        after: { number, supplierId, source: input.source, requisitionId: pr.id, quotationId: source.quotationId, lines: priced.length, total: totals.total },
      });
      return po.id;
    });
    return this.get(user, id);
  }

  async update(user: SessionUser, id: string, input: UpdatePurchaseOrderInput) {
    await this.load(user, id, 'EDIT');
    if (input.warehouseId) await this.validator.assertWarehouse(this.prisma, user.companyId, input.warehouseId);
    await this.prisma.$transaction(async (tx) => {
      const before = await this.lock(tx, id);
      if (before.status !== 'DRAFT') throw new BusinessRuleError(`A ${before.status} purchase order cannot be edited; only drafts can`);
      if (before.requisitionId) await tx.$queryRaw`SELECT id FROM "PurchaseRequisition" WHERE id = ${before.requisitionId} FOR UPDATE`;

      if (input.lines) await this.applyLineEdits(tx, id, input.lines);
      const header = {
        warehouseId: input.warehouseId, orderDate: input.orderDate, expectedDate: input.expectedDate,
        deliveryLocation: input.deliveryLocation, paymentTerms: input.paymentTerms, terms: input.terms,
        ...(input.freight === undefined ? {} : { freight: round2(input.freight) }),
      };
      await tx.purchaseOrder.update({ where: { id }, data: header });
      const after = await this.recomputeTotals(tx, id);
      if (before.requisitionId) await refreshRequisitionOrdering(tx, before.requisitionId);
      await this.audit.record(tx, {
        companyId: user.companyId, userId: user.id, entityType: DOC, entityId: id, action: 'UPDATE',
        before: { total: before.totalAmount, expectedDate: before.expectedDate, freight: before.freight },
        after: { total: after.totalAmount, expectedDate: after.expectedDate, freight: after.freight, lines: input.lines?.length },
      });
    });
    return this.get(user, id);
  }

  // ---- Workflow ----------------------------------------------------------------------------------

  async submit(user: SessionUser, id: string) {
    const preview = await this.load(user, id, 'SUBMIT');
    const project = await this.projectAccess.load(user, preview.projectId, MODULE, 'SUBMIT');
    this.projectAccess.assertActive(project);
    await this.prisma.$transaction(async (tx) => {
      const po = await this.lock(tx, id);
      if (po.status !== 'DRAFT') throw new BusinessRuleError(`A ${po.status} purchase order cannot be submitted; only drafts can`);
      const lines = await tx.purchaseOrderLine.count({ where: { orderId: id } });
      if (lines === 0) throw new BusinessRuleError('A purchase order needs at least one line');
      if (po.totalAmount.lte(0)) throw new BusinessRuleError('A purchase order needs a positive total before it can be submitted');
      await this.validator.assertSupplierUsable(tx, user.companyId, po.supplierId);

      const result = await this.approvals.submit(tx, {
        companyId: user.companyId, documentType: DOC, documentId: id, documentNo: po.number,
        projectId: po.projectId, amount: po.totalAmount, requestedById: user.id,
      });
      const now = new Date();
      if (result.required) {
        await tx.purchaseOrder.update({ where: { id }, data: { status: 'PENDING_APPROVAL', submittedAt: now } });
        await this.audit.record(tx, {
          companyId: user.companyId, userId: user.id, entityType: DOC, entityId: id, action: 'SUBMIT',
          before: { status: 'DRAFT' }, after: { status: 'PENDING_APPROVAL', approvalRequestId: result.request.id, amount: po.totalAmount, steps: result.request.totalSteps },
        });
      } else {
        await tx.purchaseOrder.update({ where: { id }, data: { status: 'APPROVED', submittedAt: now, approvedAt: now } });
        await this.audit.record(tx, {
          companyId: user.companyId, userId: user.id, entityType: DOC, entityId: id, action: 'AUTO_APPROVE',
          before: { status: 'DRAFT' }, after: { status: 'APPROVED', amount: po.totalAmount },
        });
      }
    });
    return this.get(user, id);
  }

  approve(user: SessionUser, id: string, comment: string | undefined, meta: Meta) {
    return this.decide(user, id, 'APPROVED', comment, meta);
  }

  reject(user: SessionUser, id: string, comment: string, meta: Meta) {
    return this.decide(user, id, 'REJECTED', comment, meta);
  }

  async send(user: SessionUser, id: string) {
    await this.load(user, id, 'POST');
    await this.prisma.$transaction(async (tx) => {
      const po = await this.lock(tx, id);
      if (po.status !== 'APPROVED') throw new BusinessRuleError(`A ${po.status} purchase order cannot be sent; only approved ones can`);
      await this.validator.assertSupplierUsable(tx, user.companyId, po.supplierId);
      await tx.purchaseOrder.update({ where: { id }, data: { status: 'SENT', sentAt: new Date() } });
      await this.audit.record(tx, {
        companyId: user.companyId, userId: user.id, entityType: DOC, entityId: id, action: 'SEND',
        before: { status: 'APPROVED' }, after: { status: 'SENT' },
      });
    });
    return this.get(user, id);
  }

  async cancel(user: SessionUser, id: string, reason: string) {
    await this.load(user, id, 'CANCEL');
    await this.prisma.$transaction(async (tx) => {
      const po = await this.lock(tx, id);
      if (!['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SENT'].includes(po.status)) {
        throw new BusinessRuleError(`A ${po.status} purchase order cannot be cancelled`);
      }
      const received = await tx.purchaseOrderLine.count({ where: { orderId: id, receivedQty: { gt: 0 } } });
      if (received > 0) throw new BusinessRuleError('Goods have already been received against this purchase order; close it instead of cancelling');
      if (po.status === 'PENDING_APPROVAL') await this.approvals.cancel(tx, user.companyId, DOC, id);
      await this.lockRequisition(tx, po.requisitionId);
      await this.releaseAll(tx, id);
      await tx.purchaseOrder.update({ where: { id }, data: { status: 'CANCELLED', cancelledAt: new Date(), cancelReason: reason } });
      await this.audit.record(tx, {
        companyId: user.companyId, userId: user.id, entityType: DOC, entityId: id, action: 'CANCEL',
        before: { status: po.status }, after: { status: 'CANCELLED' }, reason,
      });
    });
    return this.get(user, id);
  }

  /** Closing cancels whatever has not been delivered and frees that quantity on the requisition. */
  async close(user: SessionUser, id: string, reason: string) {
    await this.load(user, id, 'CLOSE');
    await this.prisma.$transaction(async (tx) => {
      const po = await this.lock(tx, id);
      if (!['SENT', 'PARTIALLY_RECEIVED', 'RECEIVED'].includes(po.status)) {
        throw new BusinessRuleError(`A ${po.status} purchase order cannot be closed; only sent or received ones can`);
      }
      await this.lockRequisition(tx, po.requisitionId);
      const released = await this.releaseAll(tx, id);
      await tx.purchaseOrder.update({ where: { id }, data: { status: 'CLOSED', closedAt: new Date() } });
      await this.audit.record(tx, {
        companyId: user.companyId, userId: user.id, entityType: DOC, entityId: id, action: 'CLOSE',
        before: { status: po.status }, after: { status: 'CLOSED', cancelledRemainder: released }, reason,
      });
    });
    return this.get(user, id);
  }

  // ---- helpers -----------------------------------------------------------------------------------

  private async decide(user: SessionUser, id: string, decision: 'APPROVED' | 'REJECTED', comment: string | undefined, meta: Meta) {
    const po = await this.load(user, id, 'VIEW');
    if (po.status !== 'PENDING_APPROVAL') throw new BusinessRuleError(`A ${po.status} purchase order is not awaiting approval`);
    const request = await this.prisma.approvalRequest.findFirst({
      where: { companyId: user.companyId, documentType: DOC, documentId: id, status: 'PENDING' },
      select: { id: true },
    });
    if (!request) throw new BusinessRuleError('There is no pending approval request for this purchase order');
    await this.approvals.decide(user, request.id, decision, { comment }, meta);
    return this.get(user, id);
  }

  private async fromQuotation(user: SessionUser, quotationId: string) {
    const quotation = await this.prisma.supplierQuotation.findFirst({
      where: { id: quotationId, companyId: user.companyId },
      include: { lines: { orderBy: [{ rfqLine: { lineNo: 'asc' } }, { id: 'asc' }], include: { rfqLine: true } }, rfq: { include: { award: true } } },
    });
    if (!quotation) throw new BusinessRuleError('Quotation not found in this company', [{ path: 'quotationId', message: 'Quotation not found in this company' }]);
    if (quotation.rfq.status !== 'AWARDED' || quotation.rfq.award?.quotationId !== quotation.id) {
      throw new BusinessRuleError('A purchase order can only be raised from the awarded quotation of an RFQ');
    }
    if (!quotation.rfq.requisitionId) throw new BusinessRuleError('The RFQ is not linked to a requisition');
    const requisition = await this.prisma.purchaseRequisition.findFirstOrThrow({ where: { id: quotation.rfq.requisitionId, companyId: user.companyId } });
    const prLineIds = quotation.lines.flatMap((l) => (l.rfqLine.requisitionLineId ? [l.rfqLine.requisitionLineId] : []));
    const prLines = await this.prisma.purchaseRequisitionLine.findMany({ where: { id: { in: prLineIds } } });
    const prLine = new Map(prLines.map((l) => [l.id, l]));
    const lines: LineDraft[] = quotation.lines.map((l) => {
      const pl = l.rfqLine.requisitionLineId ? prLine.get(l.rfqLine.requisitionLineId) : undefined;
      if (!pl) throw new BusinessRuleError('A quotation line is not linked to a requisition line');
      return {
        requisitionLineId: pl.id, quotationLineId: l.id, itemId: l.itemId, description: l.rfqLine.description, unit: l.rfqLine.unit,
        qty: l.qty, unitPrice: l.unitPrice, discountPct: l.discountPct.toString(), taxPct: l.taxPct.toString(),
        deliveryDate: l.deliveryDate, wbsNodeId: pl.wbsNodeId, costCodeId: pl.costCodeId, boqItemId: pl.boqItemId,
      };
    });
    return {
      requisition, supplierId: quotation.supplierId, lines, freight: quotation.freight.toString(), paymentTerms: quotation.paymentTerms,
      currency: quotation.currency, quotationId: quotation.id as string | null, rfqId: quotation.rfqId as string | null,
    };
  }

  private async fromRequisition(user: SessionUser, requisitionId: string, supplierId: string, inputLines: NonNullable<CreatePurchaseOrderInput['lines']>) {
    const requisition = await this.prisma.purchaseRequisition.findFirst({ where: { id: requisitionId, companyId: user.companyId, deletedAt: null } });
    if (!requisition) throw new BusinessRuleError('Requisition not found in this company', [{ path: 'requisitionId', message: 'Requisition not found in this company' }]);
    const prLines = await this.prisma.purchaseRequisitionLine.findMany({
      where: { id: { in: inputLines.map((l) => l.requisitionLineId) }, requisitionId: requisition.id },
      include: { item: { select: { name: true } } },
    });
    const byId = new Map(prLines.map((l) => [l.id, l]));
    const issues: Array<{ path: string; message: string }> = [];
    const lines: LineDraft[] = inputLines.flatMap((l, i) => {
      const pl = byId.get(l.requisitionLineId);
      if (!pl) {
        issues.push({ path: `lines.${i}.requisitionLineId`, message: 'Line does not belong to the requisition' });
        return [];
      }
      return [{
        requisitionLineId: pl.id, quotationLineId: null, itemId: pl.itemId, description: l.description ?? pl.description ?? pl.item.name, unit: pl.unit,
        qty: dec(l.qty), unitPrice: l.unitPrice, discountPct: l.discountPct ?? '0', taxPct: l.taxPct ?? '0',
        deliveryDate: l.deliveryDate ?? null, wbsNodeId: pl.wbsNodeId, costCodeId: pl.costCodeId, boqItemId: pl.boqItemId,
      }];
    });
    if (issues.length > 0) throw new BusinessRuleError('One or more purchase order lines are invalid', issues);
    return {
      requisition, supplierId, lines, freight: '0', paymentTerms: null as string | null,
      currency: 'PHP', quotationId: null as string | null, rfqId: null as string | null,
    };
  }

  private latestDelivery(lines: LineDraft[]): Date | null {
    const dates = lines.flatMap((l) => (l.deliveryDate ? [l.deliveryDate.getTime()] : []));
    return dates.length ? new Date(Math.max(...dates)) : null;
  }

  /** Applies edits to existing draft lines; lines not mentioned are removed and their reserved quantity released. */
  private async applyLineEdits(tx: Db, orderId: string, edits: NonNullable<UpdatePurchaseOrderInput['lines']>): Promise<void> {
    const existing = await tx.purchaseOrderLine.findMany({ where: { orderId }, orderBy: { lineNo: 'asc' } });
    const byId = new Map(existing.map((l) => [l.id, l]));
    const unknown = edits.findIndex((e) => !byId.has(e.id));
    if (unknown >= 0) throw new BusinessRuleError('A line does not belong to this purchase order', [{ path: `lines.${unknown}.id`, message: 'Line does not belong to this purchase order' }]);

    const keep = new Set(edits.map((e) => e.id));
    for (const line of existing.filter((l) => !keep.has(l.id))) {
      if (line.requisitionLineId) await releaseRequisitionQty(tx, line.requisitionLineId, line.qty.minus(line.cancelledQty));
      await tx.purchaseOrderLine.delete({ where: { id: line.id } });
    }
    const ordered = [...edits].sort((a, b) => (byId.get(a.id)?.requisitionLineId ?? '').localeCompare(byId.get(b.id)?.requisitionLineId ?? ''));
    let lineNo = 0;
    for (const edit of edits) {
      lineNo += 1;
      await tx.purchaseOrderLine.update({ where: { id: edit.id }, data: { lineNo } });
    }
    for (const edit of ordered) {
      const line = byId.get(edit.id);
      if (!line) continue;
      const qty = edit.qty === undefined ? line.qty : dec(edit.qty);
      const unitPrice = edit.unitPrice ?? line.unitPrice.toString();
      const discountPct = edit.discountPct ?? line.discountPct.toString();
      const taxPct = edit.taxPct ?? line.taxPct.toString();
      const delta = qty.minus(line.qty);
      if (line.requisitionLineId) {
        if (delta.gt(0)) await reserveRequisitionQty(tx, line.requisitionLineId, delta, `lines.${edits.indexOf(edit)}.qty`);
        else if (delta.lt(0)) await releaseRequisitionQty(tx, line.requisitionLineId, delta.neg());
      }
      const money = computeLine({ qty, unitPrice, discountPct, taxPct });
      await tx.purchaseOrderLine.update({
        where: { id: edit.id },
        data: {
          qty, unitPrice, discountPct, taxPct, discountAmount: money.discount, taxAmount: money.tax, lineTotal: money.net,
          ...(edit.deliveryDate === undefined ? {} : { deliveryDate: edit.deliveryDate }),
          ...(edit.description === undefined ? {} : { description: edit.description }),
        },
      });
    }
  }

  /** Re-derives header totals from the stored (already rounded) line amounts. */
  private async recomputeTotals(tx: Db, orderId: string) {
    const po = await tx.purchaseOrder.findUniqueOrThrow({ where: { id: orderId } });
    const lines = await tx.purchaseOrderLine.findMany({ where: { orderId } });
    const totals = sumLines(
      lines.map((l) => ({ gross: l.lineTotal.plus(l.discountAmount), discount: l.discountAmount, net: l.lineTotal, tax: l.taxAmount, total: l.lineTotal.plus(l.taxAmount) })),
      po.freight,
    );
    return tx.purchaseOrder.update({
      where: { id: orderId },
      data: { subtotal: totals.subtotal, discount: totals.discount, taxAmount: totals.tax, freight: totals.freight, totalAmount: totals.total },
    });
  }

  /** Cancels every undelivered quantity, releases it on the requisition, and returns the quantity released. */
  private async releaseAll(tx: Db, orderId: string): Promise<string> {
    const po = await tx.purchaseOrder.findUniqueOrThrow({ where: { id: orderId }, select: { requisitionId: true } });
    const lines = await tx.purchaseOrderLine.findMany({ where: { orderId }, orderBy: { requisitionLineId: 'asc' } });
    let released = ZERO;
    for (const line of lines) {
      const outstanding = nonNegative(line.qty.minus(line.cancelledQty).minus(line.receivedQty));
      if (outstanding.lte(0)) continue;
      if (line.requisitionLineId) await releaseRequisitionQty(tx, line.requisitionLineId, outstanding);
      await tx.purchaseOrderLine.update({ where: { id: line.id }, data: { cancelledQty: line.cancelledQty.plus(outstanding) } });
      released = released.plus(outstanding);
    }
    if (po.requisitionId) await refreshRequisitionOrdering(tx, po.requisitionId);
    return released.toString();
  }

  private async lockRequisition(tx: Db, requisitionId: string | null): Promise<void> {
    if (requisitionId) await tx.$queryRaw`SELECT id FROM "PurchaseRequisition" WHERE id = ${requisitionId} FOR UPDATE`;
  }

  private async load(user: SessionUser, id: string, action: 'VIEW' | 'EDIT' | 'SUBMIT' | 'POST' | 'CANCEL' | 'CLOSE') {
    const po = await this.prisma.purchaseOrder.findFirst({ where: { id, companyId: user.companyId, deletedAt: null } });
    if (!po) throw new NotFoundError('Purchase order', id);
    this.access.assertCan(user, MODULE, action, { projectId: po.projectId });
    return po;
  }

  private async lock(tx: Db, id: string) {
    await tx.$queryRaw`SELECT id FROM "PurchaseOrder" WHERE id = ${id} FOR UPDATE`;
    return tx.purchaseOrder.findUniqueOrThrow({ where: { id } });
  }
}
