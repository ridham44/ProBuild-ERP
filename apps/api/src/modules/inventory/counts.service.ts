import { Injectable, OnModuleInit } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { STOCK_DOC_SORT_FIELDS } from '@probuild/shared';
import type { CreateCountInput, RecordCountInput, SessionUser, StockDocListQuery } from '@probuild/shared';
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

const DOC = 'STOCK_COUNT';
const MODULE = 'inventory.count';
type Meta = { ip?: string; userAgent?: string };
type Action = 'VIEW' | 'CREATE' | 'EDIT' | 'SUBMIT' | 'POST' | 'CANCEL';

/**
 * Stock count workflow:
 *   DRAFT (sheet snapshot, counting) -> SUBMITTED (every line counted; variances awaiting approval) -> APPROVED | REJECTED
 *   DRAFT | APPROVED -> POSTED (COUNT_VARIANCE ledger rows)    DRAFT | SUBMITTED | APPROVED -> CANCELLED
 * The sheet snapshots AVAILABLE stock per item and batch (serialized items are excluded). Variance = physical - system,
 * valued at the bucket's average cost at the time it was counted. The variance is applied relative to the snapshot, so stock
 * that moved while counting is not overwritten; a loss that no longer fits on hand is refused at posting.
 */
@Injectable()
export class CountsService extends AuditedService implements OnModuleInit {
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
    registerStockDocApproval(this.approvals, this.audit, DOC, 'stock count', async (db, companyId, id, to) => {
      const moved = await db.stockCount.updateMany({
        where: { id, companyId, status: 'SUBMITTED' },
        data: to === 'APPROVED' ? { status: 'APPROVED', approvedAt: new Date() } : { status: 'REJECTED', rejectedAt: new Date() },
      });
      return { moved: moved.count, exists: Boolean(await db.stockCount.findFirst({ where: { id, companyId }, select: { id: true } })) };
    });
  }

  list(user: SessionUser, query: StockDocListQuery) {
    const where: Prisma.StockCountWhereInput = {
      companyId: user.companyId,
      deletedAt: null,
      ...this.access.warehouseWhere(user, MODULE, 'VIEW'),
      ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(dateRange(query.from, query.to) ? { countDate: dateRange(query.from, query.to) } : {}),
      ...containsAny(query.search, ['number', 'remarks']),
    };
    return paginate(
      (args) =>
        this.prisma.stockCount.findMany({
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
      this.prisma.stockCountLine.findMany({
        where: { countId: id },
        orderBy: [{ item: { sku: 'asc' } }, { batchNo: 'asc' }, { id: 'asc' }],
        include: { item: { select: { id: true, sku: true, name: true, baseUnit: true } } },
      }),
      this.prisma.warehouse.findUniqueOrThrow({ where: { id: doc.warehouseId }, select: { id: true, code: true, name: true } }),
      this.activity.approvalsFor(user.companyId, DOC, id),
    ]);
    const totals = lines.reduce(
      (t, l) => ({ varianceValue: t.varianceValue.plus(l.varianceValue), gainValue: t.gainValue.plus(l.varianceValue.gt(0) ? l.varianceValue : 0), lossValue: t.lossValue.plus(l.varianceValue.lt(0) ? l.varianceValue : 0), counted: t.counted + (l.counted ? 1 : 0) }),
      { varianceValue: ZERO, gainValue: ZERO, lossValue: ZERO, counted: 0 },
    );
    return {
      ...doc,
      warehouse,
      lines,
      summary: { lines: lines.length, counted: totals.counted, varianceValue: totals.varianceValue.toString(), gainValue: totals.gainValue.toString(), lossValue: totals.lossValue.toString() },
      approvals,
    };
  }

  async activityFor(user: SessionUser, id: string) {
    await this.load(user, id, 'VIEW');
    return this.activity.forDocument({ companyId: user.companyId, entityType: DOC, entityId: id, approvalType: DOC });
  }

  async create(user: SessionUser, input: CreateCountInput) {
    this.access.assertCan(user, MODULE, 'CREATE', { warehouseId: input.warehouseId });
    const wh = await this.prisma.warehouse.findFirst({ where: { id: input.warehouseId, companyId: user.companyId, deletedAt: null, active: true }, select: { id: true } });
    if (!wh) throw new BusinessRuleError('Warehouse not found in this company', [{ path: 'warehouseId', message: 'Warehouse not found in this company' }]);
    const id = await this.prisma.$transaction(async (tx) => {
      const balances = await tx.stockBalance.findMany({
        where: {
          companyId: user.companyId, warehouseId: input.warehouseId, stockStatus: 'AVAILABLE', qtyOnHand: { not: 0 },
          item: { deletedAt: null, trackSerial: false, ...(input.categoryId ? { categoryId: input.categoryId } : {}), ...(input.itemIds ? { id: { in: input.itemIds } } : {}) },
        },
        orderBy: [{ itemId: 'asc' }, { batchNo: 'asc' }],
      });
      if (balances.length === 0) throw new BusinessRuleError('There is no stock matching this count sheet');
      const number = await this.numbering.next(tx, user.companyId, DOC);
      const created = await tx.stockCount.create({
        data: {
          companyId: user.companyId, number, warehouseId: input.warehouseId, countDate: input.countDate ?? new Date(), remarks: input.remarks ?? null, createdById: user.id,
          lines: {
            create: balances.map((b) => ({ itemId: b.itemId, batchNo: b.batchNo, systemQty: b.qtyOnHand, avgCost: b.avgCost, physicalQty: 0, varianceQty: 0, varianceValue: 0 })),
          },
        },
      });
      await this.audit.record(tx, {
        companyId: user.companyId, userId: user.id, entityType: DOC, entityId: created.id, action: 'CREATE',
        after: { number, warehouseId: input.warehouseId, lines: balances.length },
      });
      return created.id;
    });
    return this.get(user, id);
  }

  /** Enters physical counts; each line's variance is recomputed from its snapshot. */
  async record(user: SessionUser, id: string, input: RecordCountInput) {
    await this.load(user, id, 'EDIT');
    await this.prisma.$transaction(async (tx) => {
      const doc = await this.lock(tx, id);
      if (doc.status !== 'DRAFT') throw new BusinessRuleError(`A ${doc.status} count can no longer be edited; only drafts can`);
      const lines = await tx.stockCountLine.findMany({ where: { countId: id, id: { in: input.lines.map((l) => l.lineId) } } });
      const byId = new Map(lines.map((l) => [l.id, l]));
      const unknown = input.lines.findIndex((l) => !byId.has(l.lineId));
      if (unknown >= 0) throw new BusinessRuleError('A line does not belong to this count', [{ path: `lines.${unknown}.lineId`, message: 'Line does not belong to this count' }]);
      for (const entry of input.lines) {
        const line = byId.get(entry.lineId);
        if (!line) continue;
        const physical = dec(entry.physicalQty);
        const variance = physical.minus(line.systemQty);
        await tx.stockCountLine.update({
          where: { id: line.id },
          data: { physicalQty: physical, counted: true, varianceQty: variance, varianceValue: round2(variance.mul(line.avgCost)), reason: entry.reason ?? line.reason },
        });
      }
      await this.audit.record(tx, {
        companyId: user.companyId, userId: user.id, entityType: DOC, entityId: id, action: 'COUNT_RECORDED', after: { lines: input.lines.length },
      });
    });
    return this.get(user, id);
  }

  async submit(user: SessionUser, id: string) {
    await this.load(user, id, 'SUBMIT');
    await this.prisma.$transaction(async (tx) => {
      const doc = await this.lock(tx, id);
      if (doc.status !== 'DRAFT') throw new BusinessRuleError(`A ${doc.status} count cannot be submitted; only drafts can`);
      const lines = await tx.stockCountLine.findMany({ where: { countId: id } });
      const uncounted = lines.filter((l) => !l.counted).length;
      if (uncounted > 0) throw new BusinessRuleError(`${uncounted} line(s) have not been counted yet`);
      const missingReason = lines.filter((l) => !l.varianceQty.isZero() && !l.reason).length;
      if (missingReason > 0) throw new BusinessRuleError(`${missingReason} line(s) with a variance need a reason`);
      const value = lines.reduce((sum, l) => sum.plus(l.varianceValue.abs()), ZERO);
      const result = await this.approvals.submit(tx, {
        companyId: user.companyId, documentType: DOC, documentId: id, documentNo: doc.number, amount: value, requestedById: user.id,
      });
      const now = new Date();
      if (result.required) {
        await tx.stockCount.update({ where: { id }, data: { status: 'SUBMITTED', submittedAt: now } });
        await this.audit.record(tx, {
          companyId: user.companyId, userId: user.id, entityType: DOC, entityId: id, action: 'SUBMIT',
          before: { status: 'DRAFT' }, after: { status: 'SUBMITTED', approvalRequestId: result.request.id, amount: value },
        });
      } else {
        await tx.stockCount.update({ where: { id }, data: { status: 'APPROVED', submittedAt: now, approvedAt: now } });
        await this.audit.record(tx, {
          companyId: user.companyId, userId: user.id, entityType: DOC, entityId: id, action: 'AUTO_APPROVE', before: { status: 'DRAFT' }, after: { status: 'APPROVED', amount: value },
        });
      }
    });
    return this.get(user, id);
  }

  async decide(user: SessionUser, id: string, decision: 'APPROVED' | 'REJECTED', comment: string | undefined, meta: Meta) {
    const doc = await this.load(user, id, 'VIEW');
    await decideStockDoc(this.prisma, this.approvals, user, DOC, 'stock count', doc, decision, comment, meta);
    return this.get(user, id);
  }

  async post(user: SessionUser, id: string) {
    await this.load(user, id, 'POST');
    await this.prisma.$transaction(async (tx) => {
      const doc = await this.lock(tx, id);
      if (doc.status !== 'APPROVED') {
        throw new BusinessRuleError(doc.status === 'DRAFT' ? 'A count must be submitted (and approved) before its variances are posted' : `A ${doc.status} count cannot be posted`);
      }
      const lines = await tx.stockCountLine.findMany({ where: { countId: id, NOT: { varianceQty: 0 } }, orderBy: { id: 'asc' }, include: { item: true } });
      await this.stock.lockBuckets(tx, lines.map((l) => ({ warehouseId: doc.warehouseId, itemId: l.itemId })));
      for (const line of lines) {
        const gain = line.varianceQty.gt(0);
        const unitCost = gain ? this.gainCost(line) : undefined;
        await this.stock.post(tx, [{
          companyId: user.companyId, txnDate: doc.countDate, txnType: 'COUNT_VARIANCE', warehouseId: doc.warehouseId, itemId: line.itemId, batchNo: line.batchNo,
          qty: line.varianceQty, unitCost, sourceType: DOC, sourceId: id, userId: user.id, remarks: line.reason ?? `Count ${doc.number}`,
        }]);
      }
      await tx.stockCount.update({ where: { id }, data: { status: 'POSTED', postedAt: new Date() } });
      await this.audit.record(tx, {
        companyId: user.companyId, userId: user.id, entityType: DOC, entityId: id, action: 'POST',
        before: { status: 'APPROVED' }, after: { status: 'POSTED', number: doc.number, variances: lines.length },
      });
    });
    return this.get(user, id);
  }

  async cancel(user: SessionUser, id: string, reason: string) {
    await this.load(user, id, 'CANCEL');
    await this.prisma.$transaction(async (tx) => {
      const doc = await this.lock(tx, id);
      if (!['DRAFT', 'SUBMITTED', 'APPROVED'].includes(doc.status)) {
        throw new BusinessRuleError(doc.status === 'POSTED' ? 'A posted count cannot be cancelled; post an adjustment instead' : `A ${doc.status} count cannot be cancelled`);
      }
      if (doc.status === 'SUBMITTED') await this.approvals.cancel(tx, user.companyId, DOC, id);
      await tx.stockCount.update({ where: { id }, data: { status: 'CANCELLED', cancelledAt: new Date(), cancelReason: reason } });
      await this.audit.record(tx, {
        companyId: user.companyId, userId: user.id, entityType: DOC, entityId: id, action: 'CANCEL', before: { status: doc.status }, after: { status: 'CANCELLED' }, reason,
      });
    });
    return this.get(user, id);
  }

  private gainCost(line: { avgCost: Prisma.Decimal; item: { sku: string; lastPurchaseCost: Prisma.Decimal; standardCost: Prisma.Decimal } }): Prisma.Decimal {
    const cost = [line.avgCost, line.item.lastPurchaseCost, line.item.standardCost].find((c) => c.gt(0));
    if (!cost) throw new BusinessRuleError(`No cost is known for ${line.item.sku}; post the gain as a stock adjustment with a unit cost`);
    return cost;
  }

  private async load(user: SessionUser, id: string, action: Action) {
    const doc = await this.prisma.stockCount.findFirst({ where: { id, companyId: user.companyId, deletedAt: null } });
    if (!doc) throw new NotFoundError('Stock count', id);
    this.access.assertCan(user, MODULE, action, { warehouseId: doc.warehouseId });
    return doc;
  }

  private async lock(tx: Db, id: string) {
    await tx.$queryRaw`SELECT id FROM "StockCount" WHERE id = ${id} FOR UPDATE`;
    return tx.stockCount.findUniqueOrThrow({ where: { id } });
  }
}
