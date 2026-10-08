import { Injectable, OnModuleInit } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { STOCK_DOC_SORT_FIELDS } from '@probuild/shared';
import type { AdjustmentLineInput, CreateAdjustmentInput, SessionUser, StockDocListQuery, UpdateAdjustmentInput } from '@probuild/shared';
import { AccessService } from '../../common/access.service';
import { AuditedService } from '../../common/audited-service';
import { BusinessRuleError, NotFoundError } from '../../common/errors/domain-errors';
import { buildOrderBy, containsAny, dateRange } from '../../common/list';
import { dec, round2, ZERO } from '../../common/money';
import { paginate } from '../../common/pagination';
import { ActivityService } from '../../engines/activity/activity.service';
import { ApprovalsService } from '../../engines/approvals/approvals.service';
import { AuditService } from '../../engines/audit/audit.service';
import { NumberingService } from '../../engines/numbering/numbering.service';
import { StockLedgerService } from '../../engines/stock-ledger/stock-ledger.service';
import { Db, PrismaService } from '../../prisma/prisma.service';
import { decideStockDoc, registerStockDocApproval } from './stock-doc-workflow';
import { loadItems, throwIfIssues, LineIssue } from './stock-lines';

const DOC = 'STOCK_ADJUSTMENT';
const MODULE = 'inventory.adjustment';
type Meta = { ip?: string; userAgent?: string };
type Action = 'VIEW' | 'CREATE' | 'EDIT' | 'SUBMIT' | 'POST' | 'CANCEL';

/**
 * Stock adjustment workflow (quantities are in the item's base unit):
 *   DRAFT -> SUBMITTED -> APPROVED | REJECTED   (STOCK_ADJUSTMENT workflow; without one, submit approves immediately)
 *   DRAFT | APPROVED -> POSTED                  (DRAFT may post directly only when no workflow covers its value)
 *   DRAFT | SUBMITTED | APPROVED -> CANCELLED
 * A reason is mandatory. Gains post ADJUSTMENT_GAIN at the stated unit cost (default: current average cost, then the last
 * purchase cost); losses post ADJUSTMENT_LOSS at the weighted-average cost of the bucket. Serialized items are not adjusted
 * here. A posted adjustment is corrected by posting another one.
 */
@Injectable()
export class AdjustmentsService extends AuditedService implements OnModuleInit {
  constructor(
    prisma: PrismaService,
    audit: AuditService,
    private readonly access: AccessService,
    private readonly approvals: ApprovalsService,
    private readonly activity: ActivityService,
    private readonly numbering: NumberingService,
    private readonly stock: StockLedgerService,
  ) {
    super(prisma, audit);
  }

  onModuleInit(): void {
    registerStockDocApproval(this.approvals, this.audit, DOC, 'stock adjustment', async (db, companyId, id, to) => {
      const moved = await db.stockAdjustment.updateMany({
        where: { id, companyId, status: 'SUBMITTED' },
        data: to === 'APPROVED' ? { status: 'APPROVED', approvedAt: new Date() } : { status: 'REJECTED', rejectedAt: new Date() },
      });
      return { moved: moved.count, exists: Boolean(await db.stockAdjustment.findFirst({ where: { id, companyId }, select: { id: true } })) };
    });
  }

  list(user: SessionUser, query: StockDocListQuery) {
    const where: Prisma.StockAdjustmentWhereInput = {
      companyId: user.companyId,
      deletedAt: null,
      ...this.access.warehouseWhere(user, MODULE, 'VIEW'),
      ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(dateRange(query.from, query.to) ? { adjustDate: dateRange(query.from, query.to) } : {}),
      ...containsAny(query.search, ['number', 'reason']),
    };
    return paginate(
      (args) =>
        this.prisma.stockAdjustment.findMany({
          where,
          orderBy: buildOrderBy(query.sort, STOCK_DOC_SORT_FIELDS, [{ createdAt: 'desc' }]),
          include: { warehouse: { select: { id: true, code: true, name: true } }, _count: { select: { lines: true } } },
          ...args,
        }),
      query,
    );
  }

  async get(user: SessionUser, id: string) {
    const doc = await this.load(user, id, 'VIEW');
    const [lines, warehouse, approvals] = await Promise.all([
      this.prisma.stockAdjustmentLine.findMany({
        where: { adjustmentId: id },
        orderBy: { lineNo: 'asc' },
        include: { item: { select: { id: true, sku: true, name: true, baseUnit: true } } },
      }),
      this.prisma.warehouse.findUniqueOrThrow({ where: { id: doc.warehouseId }, select: { id: true, code: true, name: true } }),
      this.activity.approvalsFor(user.companyId, DOC, id),
    ]);
    return {
      ...doc,
      warehouse,
      lines: lines.map((l) => ({ ...l, value: round2(l.qtyDelta.abs().mul(l.unitCost)).mul(l.qtyDelta.isNeg() ? -1 : 1).toString() })),
      approvals,
    };
  }

  async activityFor(user: SessionUser, id: string) {
    await this.load(user, id, 'VIEW');
    return this.activity.forDocument({ companyId: user.companyId, entityType: DOC, entityId: id, approvalType: DOC });
  }

  async create(user: SessionUser, input: CreateAdjustmentInput) {
    this.access.assertCan(user, MODULE, 'CREATE', { warehouseId: input.warehouseId });
    await this.assertWarehouse(this.prisma, user.companyId, input.warehouseId);
    const lines = await this.resolveLines(this.prisma, user.companyId, input.lines);
    const id = await this.prisma.$transaction(async (tx) => {
      const number = await this.numbering.next(tx, user.companyId, DOC);
      const created = await tx.stockAdjustment.create({
        data: { companyId: user.companyId, number, warehouseId: input.warehouseId, adjustDate: input.adjustDate ?? new Date(), reason: input.reason, createdById: user.id, lines: { create: lines } },
      });
      await this.audit.record(tx, {
        companyId: user.companyId, userId: user.id, entityType: DOC, entityId: created.id, action: 'CREATE',
        after: { number, warehouseId: input.warehouseId, lines: lines.length }, reason: input.reason,
      });
      return created.id;
    });
    return this.get(user, id);
  }

  async update(user: SessionUser, id: string, input: UpdateAdjustmentInput) {
    await this.load(user, id, 'EDIT');
    const lines = input.lines ? await this.resolveLines(this.prisma, user.companyId, input.lines) : null;
    await this.prisma.$transaction(async (tx) => {
      const before = await this.lock(tx, id);
      if (before.status !== 'DRAFT') throw new BusinessRuleError(`A ${before.status} adjustment cannot be edited; only drafts can`);
      if (lines) await tx.stockAdjustmentLine.deleteMany({ where: { adjustmentId: id } });
      await tx.stockAdjustment.update({
        where: { id },
        data: { adjustDate: input.adjustDate, reason: input.reason, ...(lines ? { lines: { create: lines } } : {}) },
      });
      await this.audit.record(tx, {
        companyId: user.companyId, userId: user.id, entityType: DOC, entityId: id, action: 'UPDATE',
        before: { reason: before.reason }, after: { reason: input.reason, lines: lines?.length },
      });
    });
    return this.get(user, id);
  }

  async submit(user: SessionUser, id: string) {
    await this.load(user, id, 'SUBMIT');
    await this.prisma.$transaction(async (tx) => {
      const doc = await this.lock(tx, id);
      if (doc.status !== 'DRAFT') throw new BusinessRuleError(`A ${doc.status} adjustment cannot be submitted; only drafts can`);
      const value = await this.absoluteValue(tx, doc);
      const result = await this.approvals.submit(tx, {
        companyId: user.companyId, documentType: DOC, documentId: id, documentNo: doc.number, amount: value, requestedById: user.id,
      });
      const now = new Date();
      if (result.required) {
        await tx.stockAdjustment.update({ where: { id }, data: { status: 'SUBMITTED', submittedAt: now } });
        await this.audit.record(tx, {
          companyId: user.companyId, userId: user.id, entityType: DOC, entityId: id, action: 'SUBMIT',
          before: { status: 'DRAFT' }, after: { status: 'SUBMITTED', approvalRequestId: result.request.id, amount: value },
        });
      } else {
        await tx.stockAdjustment.update({ where: { id }, data: { status: 'APPROVED', submittedAt: now, approvedAt: now } });
        await this.audit.record(tx, {
          companyId: user.companyId, userId: user.id, entityType: DOC, entityId: id, action: 'AUTO_APPROVE', before: { status: 'DRAFT' }, after: { status: 'APPROVED', amount: value },
        });
      }
    });
    return this.get(user, id);
  }

  async decide(user: SessionUser, id: string, decision: 'APPROVED' | 'REJECTED', comment: string | undefined, meta: Meta) {
    const doc = await this.load(user, id, 'VIEW');
    await decideStockDoc(this.prisma, this.approvals, user, DOC, 'stock adjustment', doc, decision, comment, meta);
    return this.get(user, id);
  }

  async post(user: SessionUser, id: string) {
    await this.load(user, id, 'POST');
    await this.prisma.$transaction(async (tx) => {
      const doc = await this.lock(tx, id);
      if (!['DRAFT', 'APPROVED'].includes(doc.status)) throw new BusinessRuleError(`A ${doc.status} adjustment cannot be posted`);
      if (doc.status === 'DRAFT' && (await this.approvals.requiresApproval(tx, user.companyId, DOC, await this.absoluteValue(tx, doc)))) {
        throw new BusinessRuleError('This adjustment needs approval before it can be posted: submit it first');
      }
      await this.assertWarehouse(tx, user.companyId, doc.warehouseId);
      const lines = await tx.stockAdjustmentLine.findMany({ where: { adjustmentId: id }, orderBy: { lineNo: 'asc' }, include: { item: true } });
      await this.stock.lockBuckets(tx, lines.map((l) => ({ warehouseId: doc.warehouseId, itemId: l.itemId })));
      for (const line of lines) {
        const gain = line.qtyDelta.gt(0);
        const unitCost = gain ? await this.gainCost(tx, doc.warehouseId, line) : undefined;
        const row = (
          await this.stock.post(tx, [{
            companyId: user.companyId, txnDate: doc.adjustDate, txnType: gain ? 'ADJUSTMENT_GAIN' : 'ADJUSTMENT_LOSS', warehouseId: doc.warehouseId,
            itemId: line.itemId, batchNo: line.batchNo, qty: line.qtyDelta, unitCost, sourceType: DOC, sourceId: id, userId: user.id, remarks: doc.reason,
          }])
        )[0];
        if (row) await tx.stockAdjustmentLine.update({ where: { id: line.id }, data: { unitCost: row.unitCost } });
      }
      await tx.stockAdjustment.update({ where: { id }, data: { status: 'POSTED', postedAt: new Date() } });
      await this.audit.record(tx, {
        companyId: user.companyId, userId: user.id, entityType: DOC, entityId: id, action: 'POST',
        before: { status: doc.status }, after: { status: 'POSTED', number: doc.number, lines: lines.length }, reason: doc.reason,
      });
    });
    return this.get(user, id);
  }

  async cancel(user: SessionUser, id: string, reason: string) {
    await this.load(user, id, 'CANCEL');
    await this.prisma.$transaction(async (tx) => {
      const doc = await this.lock(tx, id);
      if (!['DRAFT', 'SUBMITTED', 'APPROVED'].includes(doc.status)) {
        throw new BusinessRuleError(doc.status === 'POSTED' ? 'A posted adjustment cannot be cancelled; post a counter-adjustment instead' : `A ${doc.status} adjustment cannot be cancelled`);
      }
      if (doc.status === 'SUBMITTED') await this.approvals.cancel(tx, user.companyId, DOC, id);
      await tx.stockAdjustment.update({ where: { id }, data: { status: 'CANCELLED', cancelledAt: new Date(), cancelReason: reason } });
      await this.audit.record(tx, {
        companyId: user.companyId, userId: user.id, entityType: DOC, entityId: id, action: 'CANCEL', before: { status: doc.status }, after: { status: 'CANCELLED' }, reason,
      });
    });
    return this.get(user, id);
  }

  // ---- helpers -----------------------------------------------------------------------------------

  private async resolveLines(db: Db, companyId: string, lines: AdjustmentLineInput[]): Promise<Prisma.StockAdjustmentLineUncheckedCreateWithoutAdjustmentInput[]> {
    const items = await loadItems(db, companyId, lines.map((l) => l.itemId));
    const issues: LineIssue[] = [];
    const out: Prisma.StockAdjustmentLineUncheckedCreateWithoutAdjustmentInput[] = [];
    lines.forEach((l, i) => {
      const at = (f: string) => `lines.${i}.${f}`;
      const item = items.get(l.itemId);
      if (!item) return void issues.push({ path: at('itemId'), message: 'Item not found in this company' });
      if (item.trackSerial) issues.push({ path: at('itemId'), message: `${item.sku} is serialized and cannot be adjusted by quantity` });
      if (item.trackBatch && !l.batchNo) issues.push({ path: at('batchNo'), message: `${item.sku} is batch-controlled: batch number required` });
      if (!item.trackBatch && l.batchNo) issues.push({ path: at('batchNo'), message: `${item.sku} is not batch-controlled` });
      if (dec(l.qtyDelta).lt(0) && l.unitCost !== undefined) issues.push({ path: at('unitCost'), message: 'Losses are valued at average cost; unitCost applies to gains only' });
      out.push({ lineNo: i + 1, itemId: l.itemId, batchNo: l.batchNo ?? '', qtyDelta: l.qtyDelta, unitCost: l.unitCost ?? 0 });
    });
    throwIfIssues('One or more adjustment lines are invalid', issues);
    return out;
  }

  private async gainCost(db: Db, warehouseId: string, line: { itemId: string; batchNo: string; unitCost: Prisma.Decimal; item: { lastPurchaseCost: Prisma.Decimal; standardCost: Prisma.Decimal; sku: string } }): Promise<Prisma.Decimal> {
    if (line.unitCost.gt(0)) return line.unitCost;
    const bal = await db.stockBalance.findFirst({ where: { warehouseId, itemId: line.itemId, batchNo: line.batchNo, stockStatus: 'AVAILABLE' }, select: { avgCost: true } });
    const cost = [bal?.avgCost, line.item.lastPurchaseCost, line.item.standardCost].find((c) => c !== undefined && c.gt(0));
    if (!cost) throw new BusinessRuleError(`No cost is known for ${line.item.sku}: state a unit cost for the gain`);
    return cost;
  }

  /** Sum of |delta| x cost, used to pick the approval band. Unknown gain costs fall back like posting does. */
  private async absoluteValue(db: Db, doc: { id: string; warehouseId: string }): Promise<Prisma.Decimal> {
    const lines = await db.stockAdjustmentLine.findMany({ where: { adjustmentId: doc.id }, include: { item: true } });
    let total = ZERO;
    for (const l of lines) {
      const bal = await db.stockBalance.findFirst({ where: { warehouseId: doc.warehouseId, itemId: l.itemId, batchNo: l.batchNo, stockStatus: 'AVAILABLE' }, select: { avgCost: true } });
      const cost = l.unitCost.gt(0) ? l.unitCost : [bal?.avgCost, l.item.lastPurchaseCost, l.item.standardCost].find((c) => c !== undefined && c.gt(0)) ?? ZERO;
      total = total.plus(l.qtyDelta.abs().mul(cost));
    }
    return round2(total);
  }

  private async assertWarehouse(db: Db, companyId: string, warehouseId: string): Promise<void> {
    const wh = await db.warehouse.findFirst({ where: { id: warehouseId, companyId, deletedAt: null, active: true }, select: { id: true } });
    if (!wh) throw new BusinessRuleError('Warehouse not found in this company', [{ path: 'warehouseId', message: 'Warehouse not found in this company' }]);
  }

  private async load(user: SessionUser, id: string, action: Action) {
    const doc = await this.prisma.stockAdjustment.findFirst({ where: { id, companyId: user.companyId, deletedAt: null } });
    if (!doc) throw new NotFoundError('Stock adjustment', id);
    this.access.assertCan(user, MODULE, action, { warehouseId: doc.warehouseId });
    return doc;
  }

  private async lock(tx: Db, id: string) {
    await tx.$queryRaw`SELECT id FROM "StockAdjustment" WHERE id = ${id} FOR UPDATE`;
    return tx.stockAdjustment.findUniqueOrThrow({ where: { id } });
  }
}
