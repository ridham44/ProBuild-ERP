import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { MI_SORT_FIELDS } from '@probuild/shared';
import type { CreateMaterialIssueInput, MaterialIssueLineInput, MaterialIssueListQuery, SessionUser, UpdateMaterialIssueInput } from '@probuild/shared';
import { AccessService } from '../../common/access.service';
import { AuditedService } from '../../common/audited-service';
import { BusinessRuleError, NotFoundError } from '../../common/errors/domain-errors';
import { buildOrderBy, containsAny, dateRange } from '../../common/list';
import { dec, nonNegative, round2, ZERO } from '../../common/money';
import { paginate } from '../../common/pagination';
import { ProjectAccessService } from '../../common/project-access.service';
import { ActivityService } from '../../engines/activity/activity.service';
import { AuditService } from '../../engines/audit/audit.service';
import { CostLedgerService } from '../../engines/cost-ledger/cost-ledger.service';
import { NotificationsService } from '../../engines/notifications/notifications.service';
import { NumberingService } from '../../engines/numbering/numbering.service';
import { StockLedgerService } from '../../engines/stock-ledger/stock-ledger.service';
import { Db, PrismaService } from '../../prisma/prisma.service';
import { factorFor, loadItems, resolveUnit, throwIfIssues, ItemWithUnits, LineIssue } from '../inventory/stock-lines';
import { BatchAllocation, fromBaseQty, pickBatchesFefo, toBaseQty } from '../inventory/stock-math';
import { MaterialDimensionsValidator } from './material-dimensions';

const DOC = 'MATERIAL_ISSUE';
const MR_DOC = 'MATERIAL_REQUEST';
const MODULE = 'inventory.issue';
type Action = 'VIEW' | 'CREATE' | 'EDIT' | 'POST' | 'CANCEL' | 'OVERRIDE';

const LINE_INCLUDE = {
  item: { select: { id: true, sku: true, name: true, baseUnit: true } },
  wbsNode: { select: { id: true, code: true, name: true } },
  costCode: { select: { id: true, code: true, name: true } },
  boqItem: { select: { id: true, itemNo: true, description: true } },
} satisfies Prisma.MaterialIssueLineInclude;

type DraftLine = Prisma.MaterialIssueLineGetPayload<{ include: { requestLine: true } }> & { item: ItemWithUnits };
type Allocation = { line: DraftLine; batchNo: string; serialNo: string | null; baseQty: Prisma.Decimal };

/**
 * Material issue workflow:
 *   DRAFT -> POSTED (ONE transaction: stock ledger outbound at weighted-average cost, issue lines, request issuedQty,
 *                    project cost ledger rows, audit, notification)
 *   DRAFT -> CANCELLED;  POSTED -> CANCELLED (reversal: stock ledger + project cost ledger reversed, request quantities restored)
 * Issuing from an APPROVED request needs inventory.issue POST and is limited to approvedQty - issuedQty per line; a direct
 * issue (no request) needs the OVERRIDE permission and a reason. Available quantity = on hand (AVAILABLE status) minus what
 * OTHER approved requests have reserved. Batches default to FEFO (soonest expiry first, expired batches never issued, then
 * oldest batch); serialized items issue one serial per unit. Cost per line = the stock bucket's weighted-average (or
 * standard) cost; MaterialIssueLine.unitCost / baseQty are per BASE unit, qty / unit are as entered.
 */
@Injectable()
export class MaterialIssuesService extends AuditedService {
  constructor(
    prisma: PrismaService,
    audit: AuditService,
    private readonly access: AccessService,
    private readonly projectAccess: ProjectAccessService,
    private readonly activity: ActivityService,
    private readonly numbering: NumberingService,
    private readonly stock: StockLedgerService,
    private readonly costLedger: CostLedgerService,
    private readonly notifications: NotificationsService,
    private readonly dimensions: MaterialDimensionsValidator,
  ) {
    super(prisma, audit);
  }

  // ---- Queries -----------------------------------------------------------------------------------

  list(user: SessionUser, query: MaterialIssueListQuery) {
    const where: Prisma.MaterialIssueWhereInput = {
      companyId: user.companyId,
      deletedAt: null,
      ...this.access.projectWhere(user, MODULE, 'VIEW'),
      ...this.access.warehouseWhere(user, MODULE, 'VIEW'),
      ...(query.projectId ? { projectId: query.projectId } : {}),
      ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
      ...(query.requestId ? { requestId: query.requestId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(dateRange(query.from, query.to) ? { issueDate: dateRange(query.from, query.to) } : {}),
      ...containsAny(query.search, ['number', 'remarks', 'receivedBy', 'deliveryRef']),
    };
    return paginate(
      (args) =>
        this.prisma.materialIssue.findMany({
          where,
          orderBy: buildOrderBy(query.sort, MI_SORT_FIELDS, [{ createdAt: 'desc' }]),
          include: {
            project: { select: { id: true, code: true, name: true } },
            warehouse: { select: { id: true, code: true, name: true } },
            request: { select: { id: true, number: true } },
            _count: { select: { lines: true } },
          },
          ...args,
        }),
      query,
    );
  }

  async get(user: SessionUser, id: string) {
    const doc = await this.load(user, id, 'VIEW');
    const [lines, project, warehouse, request, issuedBy, returns, returned] = await Promise.all([
      this.prisma.materialIssueLine.findMany({ where: { issueId: id }, orderBy: { lineNo: 'asc' }, include: LINE_INCLUDE }),
      this.prisma.project.findUniqueOrThrow({ where: { id: doc.projectId }, select: { id: true, code: true, name: true } }),
      this.prisma.warehouse.findUniqueOrThrow({ where: { id: doc.warehouseId }, select: { id: true, code: true, name: true } }),
      doc.requestId ? this.prisma.materialRequest.findUnique({ where: { id: doc.requestId }, select: { id: true, number: true, status: true } }) : Promise.resolve(null),
      this.prisma.user.findUnique({ where: { id: doc.issuedById }, select: { id: true, name: true } }),
      this.prisma.materialReturn.findMany({ where: { issueId: id, deletedAt: null }, select: { id: true, number: true, status: true, returnDate: true }, orderBy: { createdAt: 'asc' } }),
      this.prisma.materialReturnLine.groupBy({ by: ['issueLineId'], where: { issueLine: { issueId: id }, return: { status: 'POSTED' } }, _sum: { qty: true } }),
    ]);
    const returnedBy = new Map(returned.map((r) => [r.issueLineId, r._sum.qty ?? ZERO]));
    return {
      ...doc,
      project,
      warehouse,
      request,
      issuedBy,
      returns,
      lines: lines.map((l) => ({ ...l, returnedQty: (returnedBy.get(l.id) ?? ZERO).toString(), returnableQty: nonNegative(l.qty.minus(returnedBy.get(l.id) ?? ZERO)).toString() })),
    };
  }

  async activityFor(user: SessionUser, id: string) {
    await this.load(user, id, 'VIEW');
    return this.activity.forDocument({ companyId: user.companyId, entityType: DOC, entityId: id });
  }

  // ---- Draft -------------------------------------------------------------------------------------

  async create(user: SessionUser, input: CreateMaterialIssueInput) {
    const ctx = await this.resolveContext(user, input);
    const lines = await this.resolveLines(this.prisma, user.companyId, ctx, input.lines);
    const id = await this.prisma.$transaction(async (tx) => {
      const number = await this.numbering.next(tx, user.companyId, DOC);
      const created = await tx.materialIssue.create({
        data: {
          companyId: user.companyId, number, projectId: ctx.projectId, warehouseId: ctx.warehouseId, requestId: ctx.request?.id ?? null, issueDate: input.issueDate ?? new Date(),
          requestedBy: ctx.request?.requestedById ?? null, issuedById: user.id, receivedBy: input.receivedBy ?? null, vehicle: input.vehicle ?? null,
          deliveryRef: input.deliveryRef ?? null, remarks: input.remarks ?? null, lines: { create: lines },
        },
      });
      await this.audit.record(tx, {
        companyId: user.companyId, userId: user.id, entityType: DOC, entityId: created.id, action: 'CREATE',
        after: { number, requestId: ctx.request?.id ?? null, direct: !ctx.request, lines: lines.length }, reason: ctx.request ? undefined : (input.remarks ?? undefined),
      });
      return created.id;
    });
    return this.get(user, id);
  }

  async update(user: SessionUser, id: string, input: UpdateMaterialIssueInput) {
    const preview = await this.load(user, id, 'EDIT');
    const request = preview.requestId ? await this.prisma.materialRequest.findUniqueOrThrow({ where: { id: preview.requestId }, include: { lines: { orderBy: { lineNo: 'asc' } } } }) : null;
    const lines = input.lines
      ? await this.resolveLines(this.prisma, user.companyId, { projectId: preview.projectId, warehouseId: preview.warehouseId, request }, input.lines)
      : null;
    await this.prisma.$transaction(async (tx) => {
      const before = await this.lock(tx, id);
      if (before.status !== 'DRAFT') throw new BusinessRuleError(`A ${before.status} issue cannot be edited; only drafts can`);
      if (lines) await tx.materialIssueLine.deleteMany({ where: { issueId: id } });
      await tx.materialIssue.update({
        where: { id },
        data: {
          issueDate: input.issueDate, receivedBy: input.receivedBy, vehicle: input.vehicle, deliveryRef: input.deliveryRef, remarks: input.remarks,
          ...(lines ? { lines: { create: lines } } : {}),
        },
      });
      await this.audit.record(tx, {
        companyId: user.companyId, userId: user.id, entityType: DOC, entityId: id, action: 'UPDATE',
        before: { receivedBy: before.receivedBy, remarks: before.remarks }, after: { receivedBy: input.receivedBy, remarks: input.remarks, lines: lines?.length },
      });
    });
    return this.get(user, id);
  }

  // ---- Posting -----------------------------------------------------------------------------------

  async post(user: SessionUser, id: string) {
    const preview = await this.load(user, id, 'POST');
    if (!preview.requestId) this.access.assertCan(user, MODULE, 'OVERRIDE', { projectId: preview.projectId, warehouseId: preview.warehouseId });

    await this.prisma.$transaction(async (tx) => {
      const issue = await this.lock(tx, id);
      if (issue.status !== 'DRAFT') throw new BusinessRuleError(`A ${issue.status} issue cannot be posted; only drafts can`);
      const project = await tx.project.findUniqueOrThrow({ where: { id: issue.projectId } });
      this.projectAccess.assertActive(project);
      const warehouse = await tx.warehouse.findUniqueOrThrow({ where: { id: issue.warehouseId } });
      if (!warehouse.active || warehouse.deletedAt) throw new BusinessRuleError('The issuing warehouse is no longer active');

      let request: Prisma.MaterialRequestGetPayload<{ include: { lines: { orderBy: { lineNo: 'asc' } } } }> | null = null;
      if (issue.requestId) {
        await tx.$queryRaw`SELECT id FROM "MaterialRequest" WHERE id = ${issue.requestId} FOR UPDATE`;
        request = await tx.materialRequest.findUniqueOrThrow({ where: { id: issue.requestId }, include: { lines: { orderBy: { lineNo: 'asc' } } } });
        if (request.status !== 'APPROVED') throw new BusinessRuleError(`Material can only be issued against an approved request (this one is ${request.status})`);
      }

      const lines = (await tx.materialIssueLine.findMany({
        where: { issueId: id }, orderBy: { lineNo: 'asc' }, include: { requestLine: true, item: { include: { unitConversions: true } } },
      })) as DraftLine[];
      if (lines.length === 0) throw new BusinessRuleError('An issue needs at least one line');

      await this.stock.lockBuckets(tx, lines.map((l) => ({ warehouseId: issue.warehouseId, itemId: l.itemId })));
      await this.assertWithinApproval(lines, request);
      await this.assertAvailable(tx, user.companyId, issue.warehouseId, lines, request?.id);
      const allocations = await this.allocate(tx, user.companyId, issue.warehouseId, lines);

      const costRows: Array<{ alloc: Allocation; unitCost: Prisma.Decimal; totalCost: Prisma.Decimal }> = [];
      for (const alloc of allocations) {
        const l = alloc.line;
        const reqLine = l.requestLine;
        const row = (
          await this.stock.post(tx, [{
            companyId: user.companyId, txnDate: issue.issueDate, txnType: 'PROJECT_ISSUE', warehouseId: issue.warehouseId, locationId: l.locationId,
            itemId: l.itemId, batchNo: alloc.batchNo, serialNo: alloc.serialNo, qty: alloc.baseQty.neg(), sourceType: DOC, sourceId: id, projectId: issue.projectId,
            wbsNodeId: l.wbsNodeId ?? reqLine?.wbsNodeId ?? request?.wbsNodeId ?? null, costCodeId: l.costCodeId ?? reqLine?.costCodeId ?? request?.costCodeId ?? null,
            boqItemId: l.boqItemId ?? reqLine?.boqItemId ?? null, userId: user.id, remarks: request ? `Issue against ${request.number}` : `Direct issue: ${issue.remarks ?? ''}`,
          }])
        )[0];
        if (!row) throw new BusinessRuleError('The stock ledger returned no row for an issue line');
        costRows.push({ alloc, unitCost: row.unitCost, totalCost: row.value.neg() });
        await this.costLedger.record(tx, {
          companyId: user.companyId, projectId: issue.projectId, branchId: project.branchId ?? warehouse.branchId, wbsNodeId: row.wbsNodeId, boqItemId: row.boqItemId,
          costCodeId: row.costCodeId, costCategory: l.item.costCategory, txnType: 'MATERIAL_ISSUE', txnDate: issue.issueDate, warehouseId: issue.warehouseId,
          itemId: l.itemId, quantity: alloc.baseQty, unitCost: row.unitCost, totalCost: row.value.neg(), sourceType: DOC, sourceId: id, reference: issue.number, userId: user.id,
        });
        if (alloc.serialNo) {
          await tx.serialUnit.updateMany({
            where: { companyId: user.companyId, itemId: l.itemId, serialNo: alloc.serialNo },
            data: { status: 'ISSUED', projectId: issue.projectId, issuedAt: issue.issueDate },
          });
        }
      }

      await tx.materialIssueLine.deleteMany({ where: { issueId: id } });
      let lineNo = 0;
      for (const c of costRows) {
        lineNo += 1;
        const l = c.alloc.line;
        const reqLine = l.requestLine;
        const factor = factorFor(l.item, l.unit);
        await tx.materialIssueLine.create({
          data: {
            issueId: id, lineNo, itemId: l.itemId, qty: fromBaseQty(c.alloc.baseQty, factor), unit: l.unit, batchNo: c.alloc.batchNo, serialNo: c.alloc.serialNo,
            locationId: l.locationId, requestLineId: l.requestLineId, baseQty: c.alloc.baseQty, unitCost: c.unitCost, totalCost: c.totalCost,
            wbsNodeId: l.wbsNodeId ?? reqLine?.wbsNodeId ?? request?.wbsNodeId ?? null, costCodeId: l.costCodeId ?? reqLine?.costCodeId ?? request?.costCodeId ?? null,
            boqItemId: l.boqItemId ?? reqLine?.boqItemId ?? null,
          },
        });
      }
      await this.bumpIssuedQty(tx, request, costRows.map((c) => ({ line: c.alloc.line, baseQty: c.alloc.baseQty })), 1);

      const total = costRows.reduce((s, c) => s.plus(c.totalCost), ZERO);
      await tx.materialIssue.update({ where: { id }, data: { status: 'POSTED', postedAt: new Date(), totalCost: round2(total) } });
      await this.audit.record(tx, {
        companyId: user.companyId, userId: user.id, entityType: DOC, entityId: id, action: 'POST',
        before: { status: 'DRAFT' }, after: { status: 'POSTED', number: issue.number, projectId: issue.projectId, totalCost: round2(total), rows: costRows.length },
        reason: request ? undefined : (issue.remarks ?? undefined),
      });
      if (request) {
        await this.audit.record(tx, {
          companyId: user.companyId, userId: user.id, entityType: MR_DOC, entityId: request.id, action: 'ISSUE_POSTED',
          after: { issue: issue.number, totalCost: round2(total) }, sourceType: DOC, sourceId: id,
        });
        await this.notifications.notifyUsers([request.requestedById], {
          companyId: user.companyId, type: 'MATERIAL_ISSUED', title: `Materials issued against ${request.number} (${issue.number})`, entityType: DOC, entityId: id,
        }, tx);
      } else if (project.managerId) {
        await this.notifications.notifyUsers([project.managerId], {
          companyId: user.companyId, type: 'MATERIAL_ISSUED_DIRECT', title: `Direct issue ${issue.number} posted to ${project.code}`, entityType: DOC, entityId: id,
        }, tx);
      }
    });
    return this.get(user, id);
  }

  // ---- Cancel / reverse ----------------------------------------------------------------------------

  async cancel(user: SessionUser, id: string, reason: string) {
    await this.load(user, id, 'CANCEL');
    await this.prisma.$transaction(async (tx) => {
      const issue = await this.lock(tx, id);
      if (issue.status === 'CANCELLED') throw new BusinessRuleError('This issue is already cancelled');
      if (issue.status === 'DRAFT') {
        await tx.materialIssue.update({ where: { id }, data: { status: 'CANCELLED', cancelledAt: new Date(), cancelReason: reason } });
        await this.audit.record(tx, {
          companyId: user.companyId, userId: user.id, entityType: DOC, entityId: id, action: 'CANCEL', before: { status: 'DRAFT' }, after: { status: 'CANCELLED' }, reason,
        });
        return;
      }
      const returns = await tx.materialReturn.count({ where: { issueId: id, status: 'POSTED', deletedAt: null } });
      if (returns > 0) throw new BusinessRuleError('Material has been returned against this issue; cancel the returns first');
      let request: Prisma.MaterialRequestGetPayload<{ include: { lines: { orderBy: { lineNo: 'asc' } } } }> | null = null;
      if (issue.requestId) {
        await tx.$queryRaw`SELECT id FROM "MaterialRequest" WHERE id = ${issue.requestId} FOR UPDATE`;
        request = await tx.materialRequest.findUniqueOrThrow({ where: { id: issue.requestId }, include: { lines: { orderBy: { lineNo: 'asc' } } } });
      }
      const lines = (await tx.materialIssueLine.findMany({
        where: { issueId: id }, include: { requestLine: true, item: { include: { unitConversions: true } } },
      })) as DraftLine[];
      await this.stock.lockBuckets(tx, lines.map((l) => ({ warehouseId: issue.warehouseId, itemId: l.itemId })));
      await this.stock.reverse(tx, { companyId: user.companyId, sourceType: DOC, sourceId: id, userId: user.id, reason });
      await this.costLedger.reverse(tx, { companyId: user.companyId, sourceType: DOC, sourceId: id, userId: user.id });
      const serials = lines.flatMap((l) => (l.serialNo ? [{ itemId: l.itemId, serialNo: l.serialNo }] : []));
      for (const s of serials) {
        await tx.serialUnit.updateMany({
          where: { companyId: user.companyId, itemId: s.itemId, serialNo: s.serialNo },
          data: { status: 'IN_STOCK', projectId: null, issuedAt: null },
        });
      }
      await this.bumpIssuedQty(tx, request, lines.map((l) => ({ line: l, baseQty: l.baseQty })), -1);
      await tx.materialIssue.update({ where: { id }, data: { status: 'CANCELLED', cancelledAt: new Date(), cancelReason: reason } });
      await this.audit.record(tx, {
        companyId: user.companyId, userId: user.id, entityType: DOC, entityId: id, action: 'REVERSE',
        before: { status: 'POSTED' }, after: { status: 'CANCELLED', number: issue.number, totalCost: issue.totalCost }, reason,
      });
      if (request) {
        await this.audit.record(tx, {
          companyId: user.companyId, userId: user.id, entityType: MR_DOC, entityId: request.id, action: 'ISSUE_REVERSED', after: { issue: issue.number }, reason, sourceType: DOC, sourceId: id,
        });
      }
    });
    return this.get(user, id);
  }

  // ---- helpers: posting --------------------------------------------------------------------------

  /** Keeps request line issuedQty in step with what was posted (direction 1) or reversed (-1), in the request line's unit. */
  private async bumpIssuedQty(
    tx: Db,
    request: Prisma.MaterialRequestGetPayload<{ include: { lines: { orderBy: { lineNo: 'asc' } } } }> | null,
    rows: Array<{ line: DraftLine; baseQty: Prisma.Decimal }>,
    direction: 1 | -1,
  ): Promise<void> {
    if (!request) return;
    const byReqLine = new Map<string, Prisma.Decimal>();
    for (const r of rows) {
      if (!r.line.requestLineId || !r.line.requestLine) continue;
      const factor = factorFor(r.line.item, r.line.requestLine.unit);
      byReqLine.set(r.line.requestLineId, (byReqLine.get(r.line.requestLineId) ?? ZERO).plus(fromBaseQty(r.baseQty, factor)));
    }
    for (const [lineId, delta] of [...byReqLine].sort(([a], [b]) => a.localeCompare(b))) {
      const signed = direction === 1 ? delta : delta.neg();
      await tx.materialRequestLine.update({ where: { id: lineId }, data: { issuedQty: { increment: signed } } });
    }
  }

  /** Issuing can never exceed what the approver allowed, per request line, measured in base units. */
  private async assertWithinApproval(lines: DraftLine[], request: Prisma.MaterialRequestGetPayload<{ include: { lines: { orderBy: { lineNo: 'asc' } } } }> | null): Promise<void> {
    if (!request) return;
    const demand = new Map<string, Prisma.Decimal>();
    for (const l of lines) {
      if (!l.requestLineId) throw new BusinessRuleError('Every line of an issue against a request must reference a request line');
      demand.set(l.requestLineId, (demand.get(l.requestLineId) ?? ZERO).plus(toBaseQty(l.qty, factorFor(l.item, l.unit))));
    }
    for (const [lineId, base] of demand) {
      const rl = request.lines.find((r) => r.id === lineId);
      const line = lines.find((l) => l.requestLineId === lineId);
      if (!rl || !line) throw new BusinessRuleError('A line does not belong to the request');
      const factor = factorFor(line.item, rl.unit);
      const remainingBase = nonNegative(rl.approvedQty.minus(rl.issuedQty)).mul(factor);
      if (base.gt(remainingBase)) {
        throw new BusinessRuleError(
          `Cannot issue ${base} of ${line.item.sku}: only ${remainingBase} (base units) remain of the ${rl.approvedQty} ${rl.unit} approved (already issued ${rl.issuedQty})`,
          [{ path: `lines.${line.lineNo - 1}.qty`, message: 'Exceeds the approved quantity remaining' }],
        );
      }
    }
  }

  /** On hand minus what other approved requests reserve; the request being issued keeps its own reservation. */
  private async assertAvailable(tx: Db, companyId: string, warehouseId: string, lines: DraftLine[], requestId?: string): Promise<void> {
    const demand = new Map<string, { base: Prisma.Decimal; sku: string }>();
    for (const l of lines) {
      const base = toBaseQty(l.qty, factorFor(l.item, l.unit));
      demand.set(l.itemId, { base: (demand.get(l.itemId)?.base ?? ZERO).plus(base), sku: l.item.sku });
    }
    for (const [itemId, d] of demand) {
      const a = await this.stock.availability(tx, { companyId, itemId, warehouseId, excludeRequestId: requestId });
      if (a.available.lt(d.base)) {
        throw new BusinessRuleError(
          `Insufficient stock of ${d.sku}: need ${d.base}, available ${a.available} (on hand ${a.onHand}, reserved for other requests ${a.reserved})`,
          [{ path: 'lines', message: `Insufficient stock of ${d.sku}` }],
        );
      }
    }
  }

  /** Splits each draft line into ledger-sized allocations: one per batch (FEFO) or per serial number. */
  private async allocate(tx: Db, companyId: string, warehouseId: string, lines: DraftLine[]): Promise<Allocation[]> {
    const itemIds = [...new Set(lines.map((l) => l.itemId))];
    const buckets = await tx.stockBalance.findMany({ where: { companyId, warehouseId, itemId: { in: itemIds }, stockStatus: 'AVAILABLE', qtyOnHand: { gt: 0 } } });
    const remaining = new Map<string, Prisma.Decimal>(buckets.map((b) => [`${b.itemId}|${b.batchNo}`, b.qtyOnHand]));
    const batchRecords = await tx.batchRecord.findMany({ where: { companyId, itemId: { in: itemIds } } });
    const batchInfo = new Map(batchRecords.map((b) => [`${b.itemId}|${b.batchNo}`, b]));
    const usedSerials = new Set<string>();
    const out: Allocation[] = [];
    const now = new Date();

    for (const l of lines) {
      const factor = factorFor(l.item, l.unit);
      const base = toBaseQty(l.qty, factor).toDecimalPlaces(4);
      const takeFrom = (batchNo: string, qty: Prisma.Decimal) => {
        const key = `${l.itemId}|${batchNo}`;
        const have = remaining.get(key) ?? ZERO;
        if (have.lt(qty)) throw new BusinessRuleError(`Insufficient stock of ${l.item.sku}${batchNo ? ` in batch ${batchNo}` : ''}: need ${qty}, have ${have}`);
        remaining.set(key, have.minus(qty));
      };

      if (l.item.trackSerial) {
        const serials = l.serialNo ? [l.serialNo] : await this.pickSerials(tx, companyId, warehouseId, l.itemId, l.qty.toNumber(), usedSerials);
        for (const serialNo of serials) {
          if (usedSerials.has(serialNo)) throw new BusinessRuleError(`Serial ${serialNo} appears twice on this issue`);
          const unit = await tx.serialUnit.findFirst({ where: { companyId, itemId: l.itemId, serialNo, warehouseId, status: 'IN_STOCK', condition: 'GOOD', deletedAt: null } });
          if (!unit) throw new BusinessRuleError(`Serial ${serialNo} of ${l.item.sku} is not in stock at this warehouse`);
          usedSerials.add(serialNo);
          const batchNo = l.batchNo;
          takeFrom(batchNo, factor);
          out.push({ line: l, batchNo, serialNo, baseQty: factor });
        }
        continue;
      }
      if (l.item.trackBatch && !l.batchNo) {
        const candidates = [...remaining.entries()]
          .filter(([k, q]) => k.startsWith(`${l.itemId}|`) && q.gt(0))
          .map(([k, q]) => {
            const batchNo = k.slice(l.itemId.length + 1);
            const info = batchInfo.get(k);
            return { batchNo, qty: q, expiryDate: info?.expiryDate ?? null, receivedAt: info?.createdAt ?? new Date(0) };
          });
        const picks: BatchAllocation[] = pickBatchesFefo(candidates, base, now, l.item.sku);
        for (const p of picks) {
          takeFrom(p.batchNo, p.qty);
          out.push({ line: l, batchNo: p.batchNo, serialNo: null, baseQty: p.qty });
        }
        continue;
      }
      if (l.item.trackBatch) {
        const info = batchInfo.get(`${l.itemId}|${l.batchNo}`);
        if (info?.expiryDate && info.expiryDate <= now) throw new BusinessRuleError(`Batch ${l.batchNo} of ${l.item.sku} has expired and cannot be issued`);
      }
      takeFrom(l.batchNo, base);
      out.push({ line: l, batchNo: l.batchNo, serialNo: null, baseQty: base });
    }
    return out;
  }

  private async pickSerials(tx: Db, companyId: string, warehouseId: string, itemId: string, count: number, taken: Set<string>): Promise<string[]> {
    if (!Number.isInteger(count)) throw new BusinessRuleError('A serialized item is issued in whole units');
    const units = await tx.serialUnit.findMany({
      where: { companyId, itemId, warehouseId, status: 'IN_STOCK', condition: 'GOOD', deletedAt: null, serialNo: { notIn: [...taken] } },
      orderBy: { serialNo: 'asc' },
      take: count,
    });
    if (units.length < count) throw new BusinessRuleError(`Only ${units.length} serial unit(s) in stock; ${count} requested`);
    return units.map((u) => u.serialNo);
  }

  // ---- helpers: drafts ---------------------------------------------------------------------------

  private async resolveContext(user: SessionUser, input: CreateMaterialIssueInput) {
    if (input.requestId) {
      const request = await this.prisma.materialRequest.findFirst({ where: { id: input.requestId, companyId: user.companyId, deletedAt: null }, include: { lines: { orderBy: { lineNo: 'asc' } } } });
      if (!request) throw new NotFoundError('Material request', input.requestId);
      this.access.assertCan(user, MODULE, 'CREATE', { projectId: request.projectId, warehouseId: request.warehouseId });
      const project = await this.projectAccess.load(user, request.projectId, MODULE, 'CREATE');
      this.projectAccess.assertActive(project);
      if (request.status !== 'APPROVED') throw new BusinessRuleError(`Material can only be issued against an approved request (this one is ${request.status})`);
      return { projectId: request.projectId, warehouseId: request.warehouseId, request };
    }
    const projectId = input.projectId as string;
    const warehouseId = input.warehouseId as string;
    const project = await this.projectAccess.load(user, projectId, MODULE, 'CREATE');
    this.projectAccess.assertActive(project);
    this.access.assertCan(user, MODULE, 'CREATE', { projectId, warehouseId });
    this.access.assertCan(user, MODULE, 'OVERRIDE', { projectId, warehouseId });
    await this.dimensions.assertHeader(this.prisma, user.companyId, projectId, { warehouseId });
    return { projectId, warehouseId, request: null };
  }

  private async resolveLines(
    db: Db,
    companyId: string,
    ctx: { projectId: string; warehouseId: string; request: Prisma.MaterialRequestGetPayload<{ include: { lines: { orderBy: { lineNo: 'asc' } } } }> | null },
    inputLines: MaterialIssueLineInput[] | undefined,
  ): Promise<Prisma.MaterialIssueLineUncheckedCreateWithoutIssueInput[]> {
    const { request } = ctx;
    const requested: MaterialIssueLineInput[] =
      inputLines ??
      (request?.lines ?? [])
        .filter((rl) => rl.approvedQty.gt(rl.issuedQty))
        .map((rl) => ({ requestLineId: rl.id, qty: rl.approvedQty.minus(rl.issuedQty).toString(), unit: rl.unit }));
    if (requested.length === 0) throw new BusinessRuleError('Nothing is left to issue on this request');

    const reqLineById = new Map((request?.lines ?? []).map((l) => [l.id, l]));
    const itemIds = requested.map((l) => (l.requestLineId ? reqLineById.get(l.requestLineId)?.itemId : l.itemId)).filter((v): v is string => Boolean(v));
    const items = await loadItems(db, companyId, itemIds);
    const issues: LineIssue[] = [];
    const out: Prisma.MaterialIssueLineUncheckedCreateWithoutIssueInput[] = [];
    const demand = new Map<string, Prisma.Decimal>();
    let lineNo = 0;

    requested.forEach((l, i) => {
      const at = (f: string) => `lines.${i}.${f}`;
      const reqLine = l.requestLineId ? reqLineById.get(l.requestLineId) : undefined;
      if (request && !reqLine) return void issues.push({ path: at('requestLineId'), message: 'Line does not belong to the request' });
      const item = items.get(reqLine?.itemId ?? l.itemId ?? '');
      if (!item) return void issues.push({ path: at('itemId'), message: 'Item not found in this company' });
      if (item.restrictedProjectId && item.restrictedProjectId !== ctx.projectId) issues.push({ path: at('itemId'), message: `Item ${item.sku} is restricted to another project` });
      const unit = resolveUnit(item, l.unit ?? reqLine?.unit, 'issue');
      if (!unit) return void issues.push({ path: at('unit'), message: `Unit ${l.unit} is not defined for item ${item.sku}` });
      const qty = dec(l.qty);
      if (item.trackBatch === false && l.batchNo) issues.push({ path: at('batchNo'), message: `${item.sku} is not batch-controlled` });
      if (!item.trackSerial && l.serialNos?.length) issues.push({ path: at('serialNos'), message: `${item.sku} is not serialized` });
      if (item.trackSerial) {
        if (!qty.isInteger()) issues.push({ path: at('qty'), message: `${item.sku} is serialized: quantity must be a whole number` });
        if (l.serialNos && l.serialNos.length !== qty.toNumber()) issues.push({ path: at('serialNos'), message: `Provide exactly ${qty} serial number(s)` });
      }
      if (reqLine) {
        demand.set(reqLine.id, (demand.get(reqLine.id) ?? ZERO).plus(toBaseQty(qty, factorFor(item, unit))));
      }
      const common = {
        itemId: item.id, unit, batchNo: l.batchNo ?? '', locationId: l.locationId ?? null, requestLineId: reqLine?.id ?? null,
        wbsNodeId: l.wbsNodeId ?? reqLine?.wbsNodeId ?? request?.wbsNodeId ?? null, costCodeId: l.costCodeId ?? reqLine?.costCodeId ?? request?.costCodeId ?? null,
        boqItemId: l.boqItemId ?? reqLine?.boqItemId ?? null,
      };
      if (item.trackSerial && l.serialNos && l.serialNos.length > 0) {
        for (const serialNo of l.serialNos) out.push({ ...common, lineNo: ++lineNo, qty: 1, serialNo });
      } else {
        out.push({ ...common, lineNo: ++lineNo, qty: l.qty, serialNo: null });
      }
    });
    for (const [reqLineId, base] of demand) {
      const rl = reqLineById.get(reqLineId);
      const item = rl ? items.get(rl.itemId) : undefined;
      if (!rl || !item) continue;
      const remainingBase = nonNegative(rl.approvedQty.minus(rl.issuedQty)).mul(factorFor(item, rl.unit));
      if (base.gt(remainingBase)) issues.push({ path: 'lines', message: `Cannot issue ${base} of ${item.sku}: only ${remainingBase} (base units) remain approved` });
    }
    throwIfIssues('One or more issue lines are invalid', issues);
    await this.dimensions.assertLines(db, companyId, ctx.projectId, out.map((o, i) => ({ path: `lines.${i}`, wbsNodeId: o.wbsNodeId, costCodeId: o.costCodeId, boqItemId: o.boqItemId })));
    const locationIds = [...new Set(out.flatMap((o) => (o.locationId ? [o.locationId] : [])))];
    if (locationIds.length > 0) {
      const ok = await db.warehouseLocation.findMany({ where: { id: { in: locationIds }, companyId, warehouseId: ctx.warehouseId, deletedAt: null }, select: { id: true } });
      if (ok.length !== locationIds.length) throw new BusinessRuleError('A location does not belong to the issuing warehouse', [{ path: 'lines', message: 'Location does not belong to the warehouse' }]);
    }
    return out;
  }

  private async load(user: SessionUser, id: string, action: Action) {
    const doc = await this.prisma.materialIssue.findFirst({ where: { id, companyId: user.companyId, deletedAt: null } });
    if (!doc) throw new NotFoundError('Material issue', id);
    this.access.assertCan(user, MODULE, action, { projectId: doc.projectId, warehouseId: doc.warehouseId });
    return doc;
  }

  private async lock(tx: Db, id: string) {
    await tx.$queryRaw`SELECT id FROM "MaterialIssue" WHERE id = ${id} FOR UPDATE`;
    return tx.materialIssue.findUniqueOrThrow({ where: { id } });
  }
}
