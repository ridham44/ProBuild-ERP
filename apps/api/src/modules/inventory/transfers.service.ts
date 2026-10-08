import { ForbiddenException, Injectable, OnModuleInit } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { STOCK_DOC_SORT_FIELDS } from '@probuild/shared';
import type { CreateTransferInput, SessionUser, StockDocListQuery, TransferLineInput, UpdateTransferInput } from '@probuild/shared';
import { AccessService } from '../../common/access.service';
import { AuditedService } from '../../common/audited-service';
import { BusinessRuleError, NotFoundError } from '../../common/errors/domain-errors';
import { buildOrderBy, containsAny, dateRange } from '../../common/list';
import { dec, ZERO } from '../../common/money';
import { paginate } from '../../common/pagination';
import { ActivityService } from '../../engines/activity/activity.service';
import { ApprovalsService } from '../../engines/approvals/approvals.service';
import { AuditService } from '../../engines/audit/audit.service';
import { NumberingService } from '../../engines/numbering/numbering.service';
import { StockLedgerService } from '../../engines/stock-ledger/stock-ledger.service';
import { Db, PrismaService } from '../../prisma/prisma.service';
import { decideStockDoc, registerStockDocApproval } from './stock-doc-workflow';
import { factorFor, loadItems, resolveUnit, throwIfIssues, trackingIssues, LineIssue } from './stock-lines';
import { toBaseQty } from './stock-math';

const DOC = 'WAREHOUSE_TRANSFER';
const MODULE = 'inventory.transfer';
type Meta = { ip?: string; userAgent?: string };
type Action = 'VIEW' | 'CREATE' | 'EDIT' | 'SUBMIT' | 'POST' | 'CANCEL';

const INCLUDE = {
  fromWarehouse: { select: { id: true, code: true, name: true } },
  toWarehouse: { select: { id: true, code: true, name: true } },
} satisfies Prisma.WarehouseTransferInclude;

/**
 * Warehouse transfer workflow:
 *   DRAFT -> SUBMITTED -> APPROVED | REJECTED   (only when an active WAREHOUSE_TRANSFER workflow covers the value;
 *                                                otherwise submit approves immediately and DRAFT may be posted directly)
 *   DRAFT | APPROVED -> POSTED   (stock leaves the source at its weighted-average cost and arrives at the same cost;
 *                                  batch and serial identity are kept)
 *   DRAFT | SUBMITTED | APPROVED -> CANCELLED
 * Stock reserved by approved material requests in the source warehouse cannot be transferred away.
 */
@Injectable()
export class TransfersService extends AuditedService implements OnModuleInit {
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
    registerStockDocApproval(this.approvals, this.audit, DOC, 'warehouse transfer', async (db, companyId, id, to) => {
      const moved = await db.warehouseTransfer.updateMany({
        where: { id, companyId, status: 'SUBMITTED' },
        data: to === 'APPROVED' ? { status: 'APPROVED', approvedAt: new Date() } : { status: 'REJECTED', rejectedAt: new Date() },
      });
      return { moved: moved.count, exists: Boolean(await db.warehouseTransfer.findFirst({ where: { id, companyId }, select: { id: true } })) };
    });
  }

  list(user: SessionUser, query: StockDocListQuery) {
    const scope = this.access.warehouseScope(user, MODULE, 'VIEW');
    const where: Prisma.WarehouseTransferWhereInput = {
      companyId: user.companyId,
      deletedAt: null,
      ...(scope === 'ALL' ? {} : { OR: [{ fromWarehouseId: { in: scope } }, { toWarehouseId: { in: scope } }] }),
      ...(query.status ? { status: query.status } : {}),
      ...(query.warehouseId ? { AND: [{ OR: [{ fromWarehouseId: query.warehouseId }, { toWarehouseId: query.warehouseId }] }] } : {}),
      ...(dateRange(query.from, query.to) ? { transferDate: dateRange(query.from, query.to) } : {}),
      ...containsAny(query.search, ['number', 'remarks']),
    };
    return paginate(
      (args) =>
        this.prisma.warehouseTransfer.findMany({
          where,
          orderBy: buildOrderBy(query.sort, STOCK_DOC_SORT_FIELDS, [{ createdAt: 'desc' }]),
          include: { ...INCLUDE, _count: { select: { lines: true } } },
          ...args,
        }),
      query,
    );
  }

  async get(user: SessionUser, id: string) {
    const doc = await this.load(user, id, 'VIEW');
    const [lines, approvals] = await Promise.all([
      this.prisma.warehouseTransferLine.findMany({
        where: { transferId: id },
        orderBy: { createdAt: 'asc' },
        include: { item: { select: { id: true, sku: true, name: true, baseUnit: true } } },
      }),
      this.activity.approvalsFor(user.companyId, DOC, id),
    ]);
    const [fromWarehouse, toWarehouse] = await Promise.all([
      this.prisma.warehouse.findUniqueOrThrow({ where: { id: doc.fromWarehouseId }, select: { id: true, code: true, name: true } }),
      this.prisma.warehouse.findUniqueOrThrow({ where: { id: doc.toWarehouseId }, select: { id: true, code: true, name: true } }),
    ]);
    return { ...doc, fromWarehouse, toWarehouse, lines, approvals };
  }

  async activityFor(user: SessionUser, id: string) {
    await this.load(user, id, 'VIEW');
    return this.activity.forDocument({ companyId: user.companyId, entityType: DOC, entityId: id, approvalType: DOC });
  }

  async create(user: SessionUser, input: CreateTransferInput) {
    this.access.assertCan(user, MODULE, 'CREATE', { warehouseId: input.fromWarehouseId });
    await this.assertRefs(this.prisma, user.companyId, input);
    const resolved = await this.resolveLines(this.prisma, user.companyId, input.lines);
    const id = await this.prisma.$transaction(async (tx) => {
      const number = await this.numbering.next(tx, user.companyId, DOC);
      const created = await tx.warehouseTransfer.create({
        data: {
          companyId: user.companyId, number, fromWarehouseId: input.fromWarehouseId, toWarehouseId: input.toWarehouseId,
          fromProjectId: input.fromProjectId ?? null, toProjectId: input.toProjectId ?? null, transferDate: input.transferDate ?? new Date(),
          remarks: input.remarks ?? null, createdById: user.id, lines: { create: resolved },
        },
      });
      await this.audit.record(tx, {
        companyId: user.companyId, userId: user.id, entityType: DOC, entityId: created.id, action: 'CREATE',
        after: { number, from: input.fromWarehouseId, to: input.toWarehouseId, lines: resolved.length },
      });
      return created.id;
    });
    return this.get(user, id);
  }

  async update(user: SessionUser, id: string, input: UpdateTransferInput) {
    const preview = await this.load(user, id, 'EDIT');
    await this.assertRefs(this.prisma, user.companyId, { fromWarehouseId: input.fromWarehouseId ?? preview.fromWarehouseId, toWarehouseId: input.toWarehouseId ?? preview.toWarehouseId, fromProjectId: input.fromProjectId, toProjectId: input.toProjectId });
    const resolved = input.lines ? await this.resolveLines(this.prisma, user.companyId, input.lines) : null;
    await this.prisma.$transaction(async (tx) => {
      const before = await this.lock(tx, id);
      if (before.status !== 'DRAFT') throw new BusinessRuleError(`A ${before.status} transfer cannot be edited; only drafts can`);
      if (resolved) await tx.warehouseTransferLine.deleteMany({ where: { transferId: id } });
      await tx.warehouseTransfer.update({
        where: { id },
        data: {
          fromWarehouseId: input.fromWarehouseId, toWarehouseId: input.toWarehouseId, fromProjectId: input.fromProjectId, toProjectId: input.toProjectId,
          transferDate: input.transferDate, remarks: input.remarks, ...(resolved ? { lines: { create: resolved } } : {}),
        },
      });
      await this.audit.record(tx, {
        companyId: user.companyId, userId: user.id, entityType: DOC, entityId: id, action: 'UPDATE',
        before: { from: before.fromWarehouseId, to: before.toWarehouseId }, after: { from: input.fromWarehouseId, to: input.toWarehouseId, lines: resolved?.length },
      });
    });
    return this.get(user, id);
  }

  async submit(user: SessionUser, id: string) {
    await this.load(user, id, 'SUBMIT');
    await this.prisma.$transaction(async (tx) => {
      const doc = await this.lock(tx, id);
      if (doc.status !== 'DRAFT') throw new BusinessRuleError(`A ${doc.status} transfer cannot be submitted; only drafts can`);
      const value = await this.estimatedValue(tx, doc.id, doc.fromWarehouseId);
      const result = await this.approvals.submit(tx, {
        companyId: user.companyId, documentType: DOC, documentId: id, documentNo: doc.number, amount: value, requestedById: user.id,
      });
      const now = new Date();
      if (result.required) {
        await tx.warehouseTransfer.update({ where: { id }, data: { status: 'SUBMITTED', submittedAt: now } });
        await this.audit.record(tx, {
          companyId: user.companyId, userId: user.id, entityType: DOC, entityId: id, action: 'SUBMIT',
          before: { status: 'DRAFT' }, after: { status: 'SUBMITTED', approvalRequestId: result.request.id, amount: value },
        });
      } else {
        await tx.warehouseTransfer.update({ where: { id }, data: { status: 'APPROVED', submittedAt: now, approvedAt: now } });
        await this.audit.record(tx, {
          companyId: user.companyId, userId: user.id, entityType: DOC, entityId: id, action: 'AUTO_APPROVE', before: { status: 'DRAFT' }, after: { status: 'APPROVED', amount: value },
        });
      }
    });
    return this.get(user, id);
  }

  async decide(user: SessionUser, id: string, decision: 'APPROVED' | 'REJECTED', comment: string | undefined, meta: Meta) {
    const doc = await this.load(user, id, 'VIEW');
    await decideStockDoc(this.prisma, this.approvals, user, DOC, 'warehouse transfer', doc, decision, comment, meta);
    return this.get(user, id);
  }

  async post(user: SessionUser, id: string) {
    const preview = await this.load(user, id, 'POST');
    this.access.assertCan(user, MODULE, 'POST', { warehouseId: preview.toWarehouseId });
    await this.prisma.$transaction(async (tx) => {
      const doc = await this.lock(tx, id);
      if (!['DRAFT', 'APPROVED'].includes(doc.status)) throw new BusinessRuleError(`A ${doc.status} transfer cannot be posted`);
      if (doc.status === 'DRAFT') {
        const value = await this.estimatedValue(tx, id, doc.fromWarehouseId);
        if (await this.approvals.requiresApproval(tx, user.companyId, DOC, value)) {
          throw new BusinessRuleError('This transfer needs approval before it can be posted: submit it first');
        }
      }
      await this.assertRefs(tx, user.companyId, doc);
      const lines = await tx.warehouseTransferLine.findMany({ where: { transferId: id }, orderBy: { id: 'asc' }, include: { item: { include: { unitConversions: true } } } });
      await this.stock.lockBuckets(tx, lines.map((l) => ({ warehouseId: doc.fromWarehouseId, itemId: l.itemId })));
      for (const line of lines) {
        const baseQty = toBaseQty(line.qty, factorFor(line.item, line.unit)).toDecimalPlaces(4);
        const availability = await this.stock.availability(tx, { companyId: user.companyId, itemId: line.itemId, warehouseId: doc.fromWarehouseId });
        if (availability.available.lt(baseQty)) {
          throw new BusinessRuleError(
            `Cannot transfer ${baseQty} of ${line.item.sku}: only ${availability.available} is free (on hand ${availability.onHand}, reserved ${availability.reserved})`,
          );
        }
        await this.stock.transfer(tx, {
          companyId: user.companyId, txnDate: doc.transferDate, fromWarehouseId: doc.fromWarehouseId, toWarehouseId: doc.toWarehouseId,
          itemId: line.itemId, qty: baseQty, batchNo: line.batchNo, serialNo: line.serialNo, sourceType: DOC, sourceId: id, userId: user.id,
          fromProjectId: doc.fromProjectId, toProjectId: doc.toProjectId,
        });
        if (line.serialNo) {
          const moved = await tx.serialUnit.updateMany({
            where: { companyId: user.companyId, itemId: line.itemId, serialNo: line.serialNo, warehouseId: doc.fromWarehouseId, status: 'IN_STOCK' },
            data: { warehouseId: doc.toWarehouseId },
          });
          if (moved.count !== 1) throw new BusinessRuleError(`Serial ${line.serialNo} of ${line.item.sku} is not in stock at the source warehouse`);
        }
      }
      await tx.warehouseTransfer.update({ where: { id }, data: { status: 'POSTED', postedAt: new Date() } });
      await this.audit.record(tx, {
        companyId: user.companyId, userId: user.id, entityType: DOC, entityId: id, action: 'POST',
        before: { status: doc.status }, after: { status: 'POSTED', number: doc.number, lines: lines.length },
      });
    });
    return this.get(user, id);
  }

  async cancel(user: SessionUser, id: string, reason: string) {
    await this.load(user, id, 'CANCEL');
    await this.prisma.$transaction(async (tx) => {
      const doc = await this.lock(tx, id);
      if (!['DRAFT', 'SUBMITTED', 'APPROVED'].includes(doc.status)) {
        throw new BusinessRuleError(doc.status === 'POSTED' ? 'A posted transfer cannot be cancelled; transfer the stock back instead' : `A ${doc.status} transfer cannot be cancelled`);
      }
      if (doc.status === 'SUBMITTED') await this.approvals.cancel(tx, user.companyId, DOC, id);
      await tx.warehouseTransfer.update({ where: { id }, data: { status: 'CANCELLED', cancelledAt: new Date(), cancelReason: reason } });
      await this.audit.record(tx, {
        companyId: user.companyId, userId: user.id, entityType: DOC, entityId: id, action: 'CANCEL', before: { status: doc.status }, after: { status: 'CANCELLED' }, reason,
      });
    });
    return this.get(user, id);
  }

  // ---- helpers -----------------------------------------------------------------------------------

  private async resolveLines(db: Db, companyId: string, lines: TransferLineInput[]): Promise<Prisma.WarehouseTransferLineUncheckedCreateWithoutTransferInput[]> {
    const items = await loadItems(db, companyId, lines.map((l) => l.itemId));
    const issues: LineIssue[] = [];
    const out: Prisma.WarehouseTransferLineUncheckedCreateWithoutTransferInput[] = [];
    lines.forEach((l, i) => {
      const at = (f: string) => `lines.${i}.${f}`;
      const item = items.get(l.itemId);
      if (!item) return void issues.push({ path: at('itemId'), message: 'Item not found in this company' });
      const unit = resolveUnit(item, l.unit);
      if (!unit) return void issues.push({ path: at('unit'), message: `Unit ${l.unit} is not defined for item ${item.sku}` });
      issues.push(...trackingIssues(item, l, at));
      if (item.trackSerial && !dec(l.qty).equals(1)) issues.push({ path: at('qty'), message: `${item.sku} is serialized: one line per serial, quantity 1` });
      out.push({ itemId: l.itemId, qty: l.qty, unit, batchNo: l.batchNo ?? '', serialNo: l.serialNo ?? null });
    });
    throwIfIssues('One or more transfer lines are invalid', issues);
    return out;
  }

  private async assertRefs(db: Db, companyId: string, input: { fromWarehouseId: string; toWarehouseId: string; fromProjectId?: string | null; toProjectId?: string | null }): Promise<void> {
    if (input.fromWarehouseId === input.toWarehouseId) throw new BusinessRuleError('Source and destination warehouse must differ');
    const warehouses = await db.warehouse.findMany({ where: { id: { in: [input.fromWarehouseId, input.toWarehouseId] }, companyId, deletedAt: null, active: true }, select: { id: true } });
    const found = new Set(warehouses.map((w) => w.id));
    const issues: LineIssue[] = [];
    if (!found.has(input.fromWarehouseId)) issues.push({ path: 'fromWarehouseId', message: 'Warehouse not found in this company' });
    if (!found.has(input.toWarehouseId)) issues.push({ path: 'toWarehouseId', message: 'Warehouse not found in this company' });
    const projectIds = [input.fromProjectId, input.toProjectId].filter((p): p is string => Boolean(p));
    if (projectIds.length > 0) {
      const projects = await db.project.findMany({ where: { id: { in: projectIds }, companyId, deletedAt: null }, select: { id: true } });
      const ok = new Set(projects.map((p) => p.id));
      if (input.fromProjectId && !ok.has(input.fromProjectId)) issues.push({ path: 'fromProjectId', message: 'Project not found in this company' });
      if (input.toProjectId && !ok.has(input.toProjectId)) issues.push({ path: 'toProjectId', message: 'Project not found in this company' });
    }
    throwIfIssues('Referenced records were not found', issues);
  }

  /** Value used to pick the approval band: quantity at the source's current average cost. */
  private async estimatedValue(db: Db, id: string, fromWarehouseId: string): Promise<Prisma.Decimal> {
    const lines = await db.warehouseTransferLine.findMany({ where: { transferId: id }, include: { item: { include: { unitConversions: true } } } });
    let total = ZERO;
    for (const l of lines) {
      const bal = await db.stockBalance.findFirst({ where: { warehouseId: fromWarehouseId, itemId: l.itemId, batchNo: l.batchNo, stockStatus: 'AVAILABLE' }, select: { avgCost: true } });
      total = total.plus(toBaseQty(l.qty, factorFor(l.item, l.unit)).mul(bal?.avgCost ?? l.item.lastPurchaseCost));
    }
    return total.toDecimalPlaces(2);
  }

  private async load(user: SessionUser, id: string, action: Action) {
    const doc = await this.prisma.warehouseTransfer.findFirst({ where: { id, companyId: user.companyId, deletedAt: null } });
    if (!doc) throw new NotFoundError('Warehouse transfer', id);
    const allowed =
      this.access.can(user, MODULE, action, { warehouseId: doc.fromWarehouseId }) ||
      (action === 'VIEW' && this.access.can(user, MODULE, action, { warehouseId: doc.toWarehouseId }));
    if (!allowed) throw new ForbiddenException(`You do not have ${action} permission on ${MODULE} for this record`);
    return doc;
  }

  private async lock(tx: Db, id: string) {
    await tx.$queryRaw`SELECT id FROM "WarehouseTransfer" WHERE id = ${id} FOR UPDATE`;
    return tx.warehouseTransfer.findUniqueOrThrow({ where: { id } });
  }
}
