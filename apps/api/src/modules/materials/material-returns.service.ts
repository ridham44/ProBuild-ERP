import { Injectable } from '@nestjs/common';
import { Prisma, StockStatus } from '@prisma/client';
import type { CreateMaterialReturnInput, MaterialReturnListQuery, SessionUser } from '@probuild/shared';
import { AccessService } from '../../common/access.service';
import { AuditedService } from '../../common/audited-service';
import { BusinessRuleError, NotFoundError } from '../../common/errors/domain-errors';
import { buildOrderBy, containsAny } from '../../common/list';
import { dec, nonNegative, round2, ZERO } from '../../common/money';
import { paginate } from '../../common/pagination';
import { ProjectAccessService } from '../../common/project-access.service';
import { ActivityService } from '../../engines/activity/activity.service';
import { AuditService } from '../../engines/audit/audit.service';
import { CostLedgerService } from '../../engines/cost-ledger/cost-ledger.service';
import { NumberingService } from '../../engines/numbering/numbering.service';
import { StockLedgerService } from '../../engines/stock-ledger/stock-ledger.service';
import { Db, PrismaService } from '../../prisma/prisma.service';
import { baseUnitFactor } from '../inventory/units';
import { LineIssue, throwIfIssues } from '../inventory/stock-lines';
import { toBaseQty } from '../inventory/stock-math';

const DOC = 'MATERIAL_RETURN';
const MODULE = 'inventory.return';
type Action = 'VIEW' | 'CREATE' | 'POST' | 'CANCEL';

const STATUS_OF: Record<'GOOD' | 'DAMAGED' | 'QUARANTINE', StockStatus> = { GOOD: 'AVAILABLE', DAMAGED: 'DAMAGED', QUARANTINE: 'QUARANTINE' };

/**
 * Material return workflow:
 *   DRAFT -> POSTED (stock ledger PROJECT_RETURN rows, NEGATIVE project cost rows, audit) -> CANCELLED (reversal)
 *   DRAFT -> CANCELLED
 * A return always points at the issue line it hands back. It re-enters stock at the cost the issue was charged at and
 * credits the project the same proportion of that line's cost. GOOD goods become AVAILABLE; DAMAGED and QUARANTINE goods
 * land in their own stock status and never count as available. A return does not reopen the request: issuedQty stays gross.
 */
@Injectable()
export class MaterialReturnsService extends AuditedService {
  constructor(
    prisma: PrismaService,
    audit: AuditService,
    private readonly access: AccessService,
    private readonly projectAccess: ProjectAccessService,
    private readonly activity: ActivityService,
    private readonly numbering: NumberingService,
    private readonly stock: StockLedgerService,
    private readonly costLedger: CostLedgerService,
  ) {
    super(prisma, audit);
  }

  list(user: SessionUser, query: MaterialReturnListQuery) {
    const where: Prisma.MaterialReturnWhereInput = {
      companyId: user.companyId,
      deletedAt: null,
      ...this.access.projectWhere(user, MODULE, 'VIEW'),
      ...this.access.warehouseWhere(user, MODULE, 'VIEW'),
      ...(query.projectId ? { projectId: query.projectId } : {}),
      ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
      ...(query.issueId ? { issueId: query.issueId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...containsAny(query.search, ['number', 'reason']),
    };
    return paginate(
      (args) =>
        this.prisma.materialReturn.findMany({
          where,
          orderBy: buildOrderBy(query.sort, ['number', 'returnDate', 'createdAt'] as const, [{ createdAt: 'desc' }]),
          include: {
            project: { select: { id: true, code: true, name: true } },
            warehouse: { select: { id: true, code: true, name: true } },
            issue: { select: { id: true, number: true } },
            _count: { select: { lines: true } },
          },
          ...args,
        }),
      query,
    );
  }

  async get(user: SessionUser, id: string) {
    const doc = await this.load(user, id, 'VIEW');
    const [lines, project, warehouse, issue, returnedBy] = await Promise.all([
      this.prisma.materialReturnLine.findMany({ where: { returnId: id }, orderBy: { createdAt: 'asc' }, include: { item: { select: { id: true, sku: true, name: true, baseUnit: true } } } }),
      this.prisma.project.findUniqueOrThrow({ where: { id: doc.projectId }, select: { id: true, code: true, name: true } }),
      this.prisma.warehouse.findUniqueOrThrow({ where: { id: doc.warehouseId }, select: { id: true, code: true, name: true } }),
      doc.issueId ? this.prisma.materialIssue.findUnique({ where: { id: doc.issueId }, select: { id: true, number: true, status: true } }) : Promise.resolve(null),
      this.prisma.user.findUnique({ where: { id: doc.returnedById }, select: { id: true, name: true } }),
    ]);
    const totalCost = lines.reduce((s, l) => s.plus(l.totalCost), ZERO);
    return { ...doc, project, warehouse, issue, returnedBy, lines, totalCost: round2(totalCost).toString() };
  }

  async activityFor(user: SessionUser, id: string) {
    await this.load(user, id, 'VIEW');
    return this.activity.forDocument({ companyId: user.companyId, entityType: DOC, entityId: id });
  }

  async create(user: SessionUser, input: CreateMaterialReturnInput) {
    const issue = await this.prisma.materialIssue.findFirst({ where: { id: input.issueId, companyId: user.companyId, deletedAt: null } });
    if (!issue) throw new NotFoundError('Material issue', input.issueId);
    this.access.assertCan(user, MODULE, 'CREATE', { projectId: issue.projectId, warehouseId: issue.warehouseId });
    if (issue.status !== 'POSTED') throw new BusinessRuleError(`Only a posted issue can be returned against (this one is ${issue.status})`);
    const lines = await this.resolveLines(this.prisma, issue.id, input);
    const id = await this.prisma.$transaction(async (tx) => {
      const number = await this.numbering.next(tx, user.companyId, DOC);
      const created = await tx.materialReturn.create({
        data: {
          companyId: user.companyId, number, projectId: issue.projectId, warehouseId: issue.warehouseId, issueId: issue.id, returnDate: input.returnDate ?? new Date(),
          returnedById: user.id, reason: input.reason, lines: { create: lines },
        },
      });
      await this.audit.record(tx, {
        companyId: user.companyId, userId: user.id, entityType: DOC, entityId: created.id, action: 'CREATE',
        after: { number, issue: issue.number, lines: lines.length }, reason: input.reason,
      });
      return created.id;
    });
    return this.get(user, id);
  }

  async post(user: SessionUser, id: string) {
    await this.load(user, id, 'POST');
    await this.prisma.$transaction(async (tx) => {
      const doc = await this.lock(tx, id);
      if (doc.status !== 'DRAFT') throw new BusinessRuleError(`A ${doc.status} return cannot be posted; only drafts can`);
      if (!doc.issueId) throw new BusinessRuleError('A return must reference its issue');
      // Returns of one issue queue on the issue row, so two returns cannot both hand back the same units.
      await tx.$queryRaw`SELECT id FROM "MaterialIssue" WHERE id = ${doc.issueId} FOR UPDATE`;
      const issue = await tx.materialIssue.findUniqueOrThrow({ where: { id: doc.issueId } });
      if (issue.status !== 'POSTED') throw new BusinessRuleError(`The issue is ${issue.status}; nothing can be returned against it`);
      const project = await tx.project.findUniqueOrThrow({ where: { id: doc.projectId } });
      this.projectAccess.assertNotEnded(project);
      const warehouse = await tx.warehouse.findUniqueOrThrow({ where: { id: doc.warehouseId } });

      const lines = await tx.materialReturnLine.findMany({ where: { returnId: id }, orderBy: { id: 'asc' }, include: { item: true, issueLine: true } });
      await this.assertReturnable(tx, id, lines);
      let total = ZERO;
      for (const line of lines) {
        const il = line.issueLine;
        if (!il) throw new BusinessRuleError('A return line has lost its issue line');
        const status = STATUS_OF[line.condition];
        const row = (
          await this.stock.post(tx, [{
            companyId: user.companyId, txnDate: doc.returnDate, txnType: 'PROJECT_RETURN', warehouseId: doc.warehouseId, locationId: il.locationId, itemId: line.itemId,
            batchNo: line.batchNo, serialNo: line.serialNo, stockStatus: status, qty: line.baseQty, unitCost: il.unitCost, sourceType: DOC, sourceId: id, projectId: doc.projectId,
            wbsNodeId: il.wbsNodeId, costCodeId: il.costCodeId, boqItemId: il.boqItemId, userId: user.id, remarks: `Return ${line.condition.toLowerCase()}: ${doc.reason ?? ''}`,
          }])
        )[0];
        if (!row) throw new BusinessRuleError('The stock ledger returned no row for a return line');
        await this.costLedger.record(tx, {
          companyId: user.companyId, projectId: doc.projectId, branchId: project.branchId ?? warehouse.branchId, wbsNodeId: il.wbsNodeId, boqItemId: il.boqItemId, costCodeId: il.costCodeId,
          costCategory: line.item.costCategory, txnType: 'MATERIAL_RETURN', txnDate: doc.returnDate, warehouseId: doc.warehouseId, itemId: line.itemId, quantity: line.baseQty.neg(),
          unitCost: il.unitCost, totalCost: line.totalCost.neg(), sourceType: DOC, sourceId: id, reference: doc.number, userId: user.id,
        });
        if (line.serialNo) {
          await tx.serialUnit.updateMany({
            where: { companyId: user.companyId, itemId: line.itemId, serialNo: line.serialNo },
            data: { status: line.condition === 'DAMAGED' ? 'DAMAGED' : 'IN_STOCK', condition: line.condition === 'GOOD' ? 'GOOD' : line.condition, projectId: null, issuedAt: null },
          });
        }
        total = total.plus(line.totalCost);
      }
      await tx.materialReturn.update({ where: { id }, data: { status: 'POSTED', postedAt: new Date() } });
      await this.audit.record(tx, {
        companyId: user.companyId, userId: user.id, entityType: DOC, entityId: id, action: 'POST',
        before: { status: 'DRAFT' }, after: { status: 'POSTED', number: doc.number, issue: issue.number, creditedCost: round2(total) }, reason: doc.reason ?? undefined,
      });
      await this.audit.record(tx, {
        companyId: user.companyId, userId: user.id, entityType: 'MATERIAL_ISSUE', entityId: issue.id, action: 'RETURN_POSTED',
        after: { return: doc.number, creditedCost: round2(total) }, sourceType: DOC, sourceId: id,
      });
    });
    return this.get(user, id);
  }

  async cancel(user: SessionUser, id: string, reason: string) {
    await this.load(user, id, 'CANCEL');
    await this.prisma.$transaction(async (tx) => {
      const doc = await this.lock(tx, id);
      if (doc.status === 'CANCELLED') throw new BusinessRuleError('This return is already cancelled');
      if (doc.status === 'DRAFT') {
        await tx.materialReturn.update({ where: { id }, data: { status: 'CANCELLED', cancelledAt: new Date(), cancelReason: reason } });
        await this.audit.record(tx, {
          companyId: user.companyId, userId: user.id, entityType: DOC, entityId: id, action: 'CANCEL', before: { status: 'DRAFT' }, after: { status: 'CANCELLED' }, reason,
        });
        return;
      }
      const lines = await tx.materialReturnLine.findMany({ where: { returnId: id } });
      await this.stock.lockBuckets(tx, lines.map((l) => ({ warehouseId: doc.warehouseId, itemId: l.itemId })));
      await this.stock.reverse(tx, { companyId: user.companyId, sourceType: DOC, sourceId: id, userId: user.id, reason });
      await this.costLedger.reverse(tx, { companyId: user.companyId, sourceType: DOC, sourceId: id, userId: user.id });
      for (const l of lines.filter((x) => x.serialNo)) {
        await tx.serialUnit.updateMany({
          where: { companyId: user.companyId, itemId: l.itemId, serialNo: l.serialNo as string },
          data: { status: 'ISSUED', projectId: doc.projectId, issuedAt: doc.returnDate, condition: 'GOOD' },
        });
      }
      await tx.materialReturn.update({ where: { id }, data: { status: 'CANCELLED', cancelledAt: new Date(), cancelReason: reason } });
      await this.audit.record(tx, {
        companyId: user.companyId, userId: user.id, entityType: DOC, entityId: id, action: 'REVERSE', before: { status: 'POSTED' }, after: { status: 'CANCELLED', number: doc.number }, reason,
      });
    });
    return this.get(user, id);
  }

  // ---- helpers -----------------------------------------------------------------------------------

  private async resolveLines(db: Db, issueId: string, input: CreateMaterialReturnInput): Promise<Prisma.MaterialReturnLineUncheckedCreateWithoutReturnInput[]> {
    const issueLines = await db.materialIssueLine.findMany({
      where: { issueId, id: { in: input.lines.map((l) => l.issueLineId) } },
      include: { item: { include: { unitConversions: true } } },
    });
    const byId = new Map(issueLines.map((l) => [l.id, l]));
    const alreadyReturned = await this.returnedByLine(db, [...byId.keys()]);
    const issues: LineIssue[] = [];
    const planned = new Map<string, Prisma.Decimal>();
    const out: Prisma.MaterialReturnLineUncheckedCreateWithoutReturnInput[] = [];
    input.lines.forEach((l, i) => {
      const at = (f: string) => `lines.${i}.${f}`;
      const il = byId.get(l.issueLineId);
      if (!il) return void issues.push({ path: at('issueLineId'), message: 'Line does not belong to this issue' });
      const qty = dec(l.qty);
      const returnable = nonNegative(il.qty.minus(alreadyReturned.get(il.id) ?? ZERO).minus(planned.get(il.id) ?? ZERO));
      if (qty.gt(returnable)) issues.push({ path: at('qty'), message: `Only ${returnable} of ${il.item.sku} can still be returned on this issue line` });
      planned.set(il.id, (planned.get(il.id) ?? ZERO).plus(qty));
      if (il.item.trackSerial && l.serialNo && l.serialNo !== il.serialNo) issues.push({ path: at('serialNo'), message: 'Serial does not match the issued unit' });
      const factor = baseUnitFactor(il.item, il.item.unitConversions, il.unit);
      const baseQty = toBaseQty(qty, factor).toDecimalPlaces(4);
      const share = il.baseQty.isZero() ? ZERO : round2(il.totalCost.mul(baseQty).div(il.baseQty));
      out.push({
        itemId: il.itemId, qty: l.qty, unit: il.unit, batchNo: il.batchNo, serialNo: il.serialNo, condition: l.condition, issueLineId: il.id,
        wbsNodeId: il.wbsNodeId, costCodeId: il.costCodeId, boqItemId: il.boqItemId, unitCost: il.unitCost, totalCost: share, baseQty,
      });
    });
    throwIfIssues('One or more return lines are invalid', issues);
    return out;
  }

  private async returnedByLine(db: Db, issueLineIds: string[], excludeReturnId?: string): Promise<Map<string, Prisma.Decimal>> {
    const rows = await db.materialReturnLine.groupBy({
      by: ['issueLineId'],
      where: { issueLineId: { in: issueLineIds }, return: { status: 'POSTED', ...(excludeReturnId ? { id: { not: excludeReturnId } } : {}) } },
      _sum: { qty: true },
    });
    return new Map(rows.flatMap((r) => (r.issueLineId ? [[r.issueLineId, r._sum.qty ?? ZERO] as const] : [])));
  }

  private async assertReturnable(tx: Db, returnId: string, lines: Array<{ issueLineId: string | null; qty: Prisma.Decimal; item: { sku: string }; issueLine: { qty: Prisma.Decimal } | null }>): Promise<void> {
    const ids = [...new Set(lines.flatMap((l) => (l.issueLineId ? [l.issueLineId] : [])))];
    const done = await this.returnedByLine(tx, ids, returnId);
    const planned = new Map<string, Prisma.Decimal>();
    for (const l of lines) {
      if (!l.issueLineId || !l.issueLine) continue;
      const total = (planned.get(l.issueLineId) ?? ZERO).plus(l.qty);
      planned.set(l.issueLineId, total);
      if (total.plus(done.get(l.issueLineId) ?? ZERO).gt(l.issueLine.qty)) {
        throw new BusinessRuleError(`Cannot return ${total} of ${l.item.sku}: only ${l.issueLine.qty.minus(done.get(l.issueLineId) ?? ZERO)} remain returnable on the issue line`);
      }
    }
  }

  private async load(user: SessionUser, id: string, action: Action) {
    const doc = await this.prisma.materialReturn.findFirst({ where: { id, companyId: user.companyId, deletedAt: null } });
    if (!doc) throw new NotFoundError('Material return', id);
    this.access.assertCan(user, MODULE, action, { projectId: doc.projectId, warehouseId: doc.warehouseId });
    return doc;
  }

  private async lock(tx: Db, id: string) {
    await tx.$queryRaw`SELECT id FROM "MaterialReturn" WHERE id = ${id} FOR UPDATE`;
    return tx.materialReturn.findUniqueOrThrow({ where: { id } });
  }
}
