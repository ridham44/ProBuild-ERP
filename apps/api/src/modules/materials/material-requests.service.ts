import { ForbiddenException, Injectable, OnModuleInit } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { MR_SORT_FIELDS } from '@probuild/shared';
import type {
  ApproveMaterialRequestInput,
  CreateMaterialRequestInput,
  MaterialRequestLineInput,
  MaterialRequestListQuery,
  SessionUser,
  UpdateMaterialRequestInput,
} from '@probuild/shared';
import { AccessService } from '../../common/access.service';
import { AuditedService } from '../../common/audited-service';
import { BusinessRuleError, NotFoundError } from '../../common/errors/domain-errors';
import { buildOrderBy, containsAny, dateRange } from '../../common/list';
import { dec, nonNegative, round2, ZERO } from '../../common/money';
import { paginate } from '../../common/pagination';
import { ProjectAccessService } from '../../common/project-access.service';
import { ActivityService } from '../../engines/activity/activity.service';
import { ApprovalsService } from '../../engines/approvals/approvals.service';
import { AuditService } from '../../engines/audit/audit.service';
import { NotificationsService } from '../../engines/notifications/notifications.service';
import { NumberingService } from '../../engines/numbering/numbering.service';
import { StockLedgerService } from '../../engines/stock-ledger/stock-ledger.service';
import { Db, PrismaService } from '../../prisma/prisma.service';
import { factorFor, loadItems, resolveUnit, throwIfIssues, LineIssue } from '../inventory/stock-lines';
import { toBaseQty } from '../inventory/stock-math';
import { MaterialDimensionsValidator } from './material-dimensions';

const DOC = 'MATERIAL_REQUEST';
const MODULE = 'inventory.request';
type Meta = { ip?: string; userAgent?: string };
type Action = 'VIEW' | 'CREATE' | 'EDIT' | 'SUBMIT' | 'CANCEL' | 'CLOSE';

const LINE_INCLUDE = {
  item: { select: { id: true, sku: true, name: true, baseUnit: true } },
  wbsNode: { select: { id: true, code: true, name: true } },
  costCode: { select: { id: true, code: true, name: true } },
  boqItem: { select: { id: true, itemNo: true, description: true } },
} satisfies Prisma.MaterialRequestLineInclude;

/**
 * Material request workflow:
 *   DRAFT -> SUBMITTED -> APPROVED | REJECTED   (MATERIAL_REQUEST workflow by estimated value; none => DRAFT -> APPROVED)
 *   DRAFT | SUBMITTED | APPROVED -> CANCELLED   (APPROVED only while nothing has been issued)
 *   APPROVED -> CLOSED                          (stops further issuing; the unissued reservation is released)
 * On submit every line's approvedQty is set to its requested qty; an approver may lower any line (to 0 to drop it) while
 * approving. While the request is APPROVED, approvedQty - issuedQty (base units) is reserved against the warehouse's
 * on-hand stock and shown as `reserved` in availability. Issuing is limited to the approved quantity.
 */
@Injectable()
export class MaterialRequestsService extends AuditedService implements OnModuleInit {
  constructor(
    prisma: PrismaService,
    audit: AuditService,
    private readonly access: AccessService,
    private readonly projectAccess: ProjectAccessService,
    private readonly approvals: ApprovalsService,
    private readonly notifications: NotificationsService,
    private readonly numbering: NumberingService,
    private readonly activity: ActivityService,
    private readonly stock: StockLedgerService,
    private readonly dimensions: MaterialDimensionsValidator,
  ) {
    super(prisma, audit);
  }

  onModuleInit(): void {
    this.approvals.registerHandler(DOC, {
      onApproved: async (db, request) => {
        const moved = await db.materialRequest.updateMany({
          where: { id: request.documentId, companyId: request.companyId, status: 'SUBMITTED' },
          data: { status: 'APPROVED', approvedAt: new Date() },
        });
        if (!(await this.settledOrMissing(db, request.documentId, request.companyId, moved.count))) return;
        await this.audit.record(db, {
          companyId: request.companyId, userId: null, entityType: DOC, entityId: request.documentId,
          action: 'STATUS_CHANGE', before: { status: 'SUBMITTED' }, after: { status: 'APPROVED' },
        });
        await this.notifications.notifyRole('Warehouse Manager', {
          companyId: request.companyId, type: 'MR_APPROVED', title: `Material request ${request.documentNo ?? ''} approved: ready to issue`.trim(),
          entityType: DOC, entityId: request.documentId,
        }, db);
      },
      onRejected: async (db, request) => {
        const moved = await db.materialRequest.updateMany({
          where: { id: request.documentId, companyId: request.companyId, status: 'SUBMITTED' },
          data: { status: 'REJECTED', rejectedAt: new Date() },
        });
        if (!(await this.settledOrMissing(db, request.documentId, request.companyId, moved.count))) return;
        await this.audit.record(db, {
          companyId: request.companyId, userId: null, entityType: DOC, entityId: request.documentId,
          action: 'STATUS_CHANGE', before: { status: 'SUBMITTED' }, after: { status: 'REJECTED' },
        });
      },
    });
  }

  private async settledOrMissing(db: Db, id: string, companyId: string, moved: number): Promise<boolean> {
    if (moved === 1) return true;
    const doc = await db.materialRequest.findFirst({ where: { id, companyId }, select: { status: true } });
    if (!doc) return false;
    throw new BusinessRuleError('The material request is no longer awaiting approval');
  }

  // ---- Queries -----------------------------------------------------------------------------------

  list(user: SessionUser, query: MaterialRequestListQuery) {
    const where: Prisma.MaterialRequestWhereInput = {
      companyId: user.companyId,
      deletedAt: null,
      ...this.access.projectWhere(user, MODULE, 'VIEW'),
      ...this.access.warehouseWhere(user, MODULE, 'VIEW'),
      ...(query.projectId ? { projectId: query.projectId } : {}),
      ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.requestedById ? { requestedById: query.requestedById } : {}),
      ...(query.issuable ? { status: 'APPROVED', lines: { some: { approvedQty: { gt: 0 } } } } : {}),
      ...(dateRange(query.from, query.to) ? { createdAt: dateRange(query.from, query.to) } : {}),
      ...containsAny(query.search, ['number', 'purpose', 'remarks']),
    };
    return paginate(
      (args) =>
        this.prisma.materialRequest.findMany({
          where,
          orderBy: buildOrderBy(query.sort, MR_SORT_FIELDS, [{ createdAt: 'desc' }]),
          include: {
            project: { select: { id: true, code: true, name: true } },
            warehouse: { select: { id: true, code: true, name: true } },
            _count: { select: { lines: true } },
          },
          ...args,
        }),
      query,
    );
  }

  async get(user: SessionUser, id: string) {
    const doc = await this.load(user, id, 'VIEW');
    const [lines, project, warehouse, requester, employee, approvals, issues] = await Promise.all([
      this.prisma.materialRequestLine.findMany({ where: { requestId: id }, orderBy: { lineNo: 'asc' }, include: LINE_INCLUDE }),
      this.prisma.project.findUniqueOrThrow({ where: { id: doc.projectId }, select: { id: true, code: true, name: true, status: true } }),
      this.prisma.warehouse.findUniqueOrThrow({ where: { id: doc.warehouseId }, select: { id: true, code: true, name: true } }),
      this.prisma.user.findUnique({ where: { id: doc.requestedById }, select: { id: true, name: true } }),
      doc.employeeId ? this.prisma.employee.findUnique({ where: { id: doc.employeeId }, select: { id: true, code: true, fullName: true } }) : Promise.resolve(null),
      this.activity.approvalsFor(user.companyId, DOC, id),
      this.prisma.materialIssue.findMany({
        where: { requestId: id, deletedAt: null },
        select: { id: true, number: true, status: true, issueDate: true, totalCost: true },
        orderBy: { createdAt: 'asc' },
      }),
    ]);
    const stock = await this.lineStock(user.companyId, doc, lines);
    return {
      ...doc,
      project,
      warehouse,
      requester,
      employee,
      lines: lines.map((l) => ({
        ...l,
        remainingQty: doc.status === 'APPROVED' ? nonNegative(l.approvedQty.minus(l.issuedQty)).toString() : '0',
        stock: stock.get(l.id) ?? { onHand: '0', reservedByOthers: '0', available: '0' },
      })),
      issues,
      approvals,
    };
  }

  async activityFor(user: SessionUser, id: string) {
    await this.load(user, id, 'VIEW');
    return this.activity.forDocument({ companyId: user.companyId, entityType: DOC, entityId: id, approvalType: DOC });
  }

  /** On-hand, others' reservations and what remains free for this request, per line (base units, summed per item). */
  private async lineStock(companyId: string, doc: { id: string; warehouseId: string; status: string }, lines: Array<{ id: string; itemId: string }>) {
    const out = new Map<string, { onHand: string; reservedByOthers: string; available: string }>();
    if (lines.length === 0) return out;
    const itemIds = [...new Set(lines.map((l) => l.itemId))];
    const [balances, reserved] = await Promise.all([
      this.prisma.stockBalance.groupBy({ by: ['itemId'], where: { companyId, warehouseId: doc.warehouseId, itemId: { in: itemIds }, stockStatus: 'AVAILABLE' }, _sum: { qtyOnHand: true } }),
      this.stock.reservedByBucket(this.prisma, { companyId, itemIds, warehouseIds: [doc.warehouseId], excludeRequestId: doc.id }),
    ]);
    const onHandOf = new Map(balances.map((b) => [b.itemId, b._sum.qtyOnHand ?? ZERO]));
    for (const l of lines) {
      const onHand = onHandOf.get(l.itemId) ?? ZERO;
      const others = reserved.get(`${doc.warehouseId}|${l.itemId}`) ?? ZERO;
      out.set(l.id, { onHand: onHand.toString(), reservedByOthers: others.toString(), available: onHand.minus(others).toString() });
    }
    return out;
  }

  // ---- Draft -------------------------------------------------------------------------------------

  async create(user: SessionUser, input: CreateMaterialRequestInput) {
    const project = await this.projectAccess.load(user, input.projectId, MODULE, 'CREATE');
    this.projectAccess.assertActive(project);
    this.access.assertCan(user, MODULE, 'CREATE', { projectId: project.id, warehouseId: input.warehouseId });
    await this.dimensions.assertHeader(this.prisma, user.companyId, project.id, input);
    const lines = await this.resolveLines(this.prisma, user.companyId, project.id, input);
    const id = await this.prisma.$transaction(async (tx) => {
      const number = await this.numbering.next(tx, user.companyId, DOC);
      const created = await tx.materialRequest.create({
        data: {
          companyId: user.companyId, number, projectId: project.id, warehouseId: input.warehouseId, requestedById: user.id, employeeId: input.employeeId ?? null,
          wbsNodeId: input.wbsNodeId ?? null, costCodeId: input.costCodeId ?? null, neededDate: input.neededDate ?? null, purpose: input.purpose ?? null,
          remarks: input.remarks ?? null, estimatedTotal: lines.estimated, lines: { create: lines.data },
        },
      });
      await this.audit.record(tx, {
        companyId: user.companyId, userId: user.id, entityType: DOC, entityId: created.id, action: 'CREATE',
        after: { number, projectId: project.id, warehouseId: input.warehouseId, lines: lines.data.length, estimatedTotal: lines.estimated },
      });
      return created.id;
    });
    return this.get(user, id);
  }

  async update(user: SessionUser, id: string, input: UpdateMaterialRequestInput) {
    const preview = await this.load(user, id, 'EDIT');
    const warehouseId = input.warehouseId ?? preview.warehouseId;
    this.access.assertCan(user, MODULE, 'EDIT', { projectId: preview.projectId, warehouseId });
    await this.dimensions.assertHeader(this.prisma, user.companyId, preview.projectId, { warehouseId, employeeId: input.employeeId, wbsNodeId: input.wbsNodeId, costCodeId: input.costCodeId });
    const lines = input.lines
      ? await this.resolveLines(this.prisma, user.companyId, preview.projectId, { ...input, lines: input.lines, wbsNodeId: input.wbsNodeId ?? preview.wbsNodeId, costCodeId: input.costCodeId ?? preview.costCodeId })
      : null;
    await this.prisma.$transaction(async (tx) => {
      const before = await this.lock(tx, id);
      if (before.status !== 'DRAFT') throw new BusinessRuleError(`A ${before.status} material request cannot be edited; only drafts can`);
      if (lines) await tx.materialRequestLine.deleteMany({ where: { requestId: id } });
      await tx.materialRequest.update({
        where: { id },
        data: {
          warehouseId: input.warehouseId, employeeId: input.employeeId, wbsNodeId: input.wbsNodeId, costCodeId: input.costCodeId, neededDate: input.neededDate,
          purpose: input.purpose, remarks: input.remarks, ...(lines ? { estimatedTotal: lines.estimated, lines: { create: lines.data } } : {}),
        },
      });
      await this.audit.record(tx, {
        companyId: user.companyId, userId: user.id, entityType: DOC, entityId: id, action: 'UPDATE',
        before: { warehouseId: before.warehouseId, neededDate: before.neededDate, purpose: before.purpose, estimatedTotal: before.estimatedTotal },
        after: { warehouseId: input.warehouseId, neededDate: input.neededDate, purpose: input.purpose, lines: lines?.data.length },
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
      const doc = await this.lock(tx, id);
      if (doc.status !== 'DRAFT') throw new BusinessRuleError(`A ${doc.status} material request cannot be submitted; only drafts can`);
      const lines = await tx.materialRequestLine.findMany({ where: { requestId: id }, include: { item: { select: { active: true, sku: true } } } });
      if (lines.length === 0) throw new BusinessRuleError('A material request needs at least one line');
      const inactive = lines.find((l) => !l.item.active);
      if (inactive) throw new BusinessRuleError(`Item ${inactive.item.sku} is inactive; remove it before submitting`);
      await tx.$executeRaw`UPDATE "MaterialRequestLine" SET "approvedQty" = "qty" WHERE "requestId" = ${id}`;

      const result = await this.approvals.submit(tx, {
        companyId: user.companyId, documentType: DOC, documentId: id, documentNo: doc.number, projectId: doc.projectId, amount: doc.estimatedTotal, requestedById: user.id,
      });
      const now = new Date();
      if (result.required) {
        await tx.materialRequest.update({ where: { id }, data: { status: 'SUBMITTED', submittedAt: now } });
        await this.audit.record(tx, {
          companyId: user.companyId, userId: user.id, entityType: DOC, entityId: id, action: 'SUBMIT',
          before: { status: 'DRAFT' }, after: { status: 'SUBMITTED', approvalRequestId: result.request.id, amount: doc.estimatedTotal, steps: result.request.totalSteps },
        });
      } else {
        await tx.materialRequest.update({ where: { id }, data: { status: 'APPROVED', submittedAt: now, approvedAt: now } });
        await this.audit.record(tx, {
          companyId: user.companyId, userId: user.id, entityType: DOC, entityId: id, action: 'AUTO_APPROVE',
          before: { status: 'DRAFT' }, after: { status: 'APPROVED', amount: doc.estimatedTotal },
        });
      }
    });
    return this.get(user, id);
  }

  /**
   * Approves (a step of) the request, optionally lowering approved quantities. The caller's authority for the current
   * step is checked BEFORE any quantity changes, so an unauthorised caller can never alter a request.
   */
  async approve(user: SessionUser, id: string, input: ApproveMaterialRequestInput, meta: Meta) {
    const doc = await this.load(user, id, 'VIEW');
    if (doc.status !== 'SUBMITTED') throw new BusinessRuleError(`A ${doc.status} material request is not awaiting approval`);
    const request = await this.pendingRequest(user.companyId, id);
    this.assertMayDecide(user, request);

    if (input.lines && input.lines.length > 0) {
      await this.prisma.$transaction(async (tx) => {
        await this.lock(tx, id);
        const lines = await tx.materialRequestLine.findMany({ where: { requestId: id } });
        const byId = new Map(lines.map((l) => [l.id, l]));
        const changes: Array<{ lineId: string; from: Prisma.Decimal; to: Prisma.Decimal }> = [];
        for (const [i, entry] of input.lines!.entries()) {
          const line = byId.get(entry.lineId);
          if (!line) throw new BusinessRuleError('A line does not belong to this request', [{ path: `lines.${i}.lineId`, message: 'Line does not belong to this request' }]);
          const approved = dec(entry.approvedQty);
          if (approved.gt(line.qty)) throw new BusinessRuleError(`Approved quantity cannot exceed the ${line.qty} requested`, [{ path: `lines.${i}.approvedQty`, message: 'Cannot exceed the requested quantity' }]);
          if (!approved.equals(line.approvedQty)) changes.push({ lineId: line.id, from: line.approvedQty, to: approved });
        }
        for (const c of changes) await tx.materialRequestLine.update({ where: { id: c.lineId }, data: { approvedQty: c.to } });
        const total = await tx.materialRequestLine.aggregate({ where: { requestId: id }, _sum: { approvedQty: true } });
        if ((total._sum.approvedQty ?? ZERO).lte(0)) throw new BusinessRuleError('Nothing would be approved: reject the request instead of approving zero quantities');
        if (changes.length > 0) {
          await this.audit.record(tx, {
            companyId: user.companyId, userId: user.id, entityType: DOC, entityId: id, action: 'QTY_ADJUSTED',
            after: { changes: changes.map((c) => ({ lineId: c.lineId, requested: byId.get(c.lineId)?.qty, from: c.from, to: c.to })) }, reason: input.comment,
          });
        }
      });
    }
    await this.approvals.decide(user, request.id, 'APPROVED', { comment: input.comment }, meta);
    return this.get(user, id);
  }

  async reject(user: SessionUser, id: string, comment: string, meta: Meta) {
    const doc = await this.load(user, id, 'VIEW');
    if (doc.status !== 'SUBMITTED') throw new BusinessRuleError(`A ${doc.status} material request is not awaiting approval`);
    const request = await this.pendingRequest(user.companyId, id);
    await this.approvals.decide(user, request.id, 'REJECTED', { comment }, meta);
    return this.get(user, id);
  }

  async cancel(user: SessionUser, id: string, reason: string) {
    await this.load(user, id, 'CANCEL');
    await this.prisma.$transaction(async (tx) => {
      const doc = await this.lock(tx, id);
      if (!['DRAFT', 'SUBMITTED', 'APPROVED'].includes(doc.status)) throw new BusinessRuleError(`A ${doc.status} material request cannot be cancelled`);
      const issued = await tx.materialRequestLine.count({ where: { requestId: id, issuedQty: { gt: 0 } } });
      if (issued > 0) throw new BusinessRuleError('Material has already been issued against this request; close it instead of cancelling');
      const drafts = await tx.materialIssue.count({ where: { requestId: id, status: 'DRAFT', deletedAt: null } });
      if (drafts > 0) throw new BusinessRuleError('Cancel the request\'s draft issues first');
      if (doc.status === 'SUBMITTED') await this.approvals.cancel(tx, user.companyId, DOC, id);
      await tx.materialRequest.update({ where: { id }, data: { status: 'CANCELLED', cancelledAt: new Date(), cancelReason: reason } });
      await this.audit.record(tx, {
        companyId: user.companyId, userId: user.id, entityType: DOC, entityId: id, action: 'CANCEL', before: { status: doc.status }, after: { status: 'CANCELLED' }, reason,
      });
    });
    return this.get(user, id);
  }

  /** Closing stops further issuing and releases whatever approved quantity was never issued. */
  async close(user: SessionUser, id: string, reason: string) {
    await this.load(user, id, 'CLOSE');
    await this.prisma.$transaction(async (tx) => {
      const doc = await this.lock(tx, id);
      if (doc.status !== 'APPROVED') throw new BusinessRuleError(`A ${doc.status} material request cannot be closed; only approved ones can`);
      const drafts = await tx.materialIssue.count({ where: { requestId: id, status: 'DRAFT', deletedAt: null } });
      if (drafts > 0) throw new BusinessRuleError('Post or cancel the request\'s draft issues before closing it');
      await tx.materialRequest.update({ where: { id }, data: { status: 'CLOSED', closedAt: new Date(), closeReason: reason } });
      await this.audit.record(tx, {
        companyId: user.companyId, userId: user.id, entityType: DOC, entityId: id, action: 'CLOSE', before: { status: 'APPROVED' }, after: { status: 'CLOSED' }, reason,
      });
    });
    return this.get(user, id);
  }

  // ---- helpers -----------------------------------------------------------------------------------

  private async pendingRequest(companyId: string, documentId: string) {
    const request = await this.prisma.approvalRequest.findFirst({ where: { companyId, documentType: DOC, documentId, status: 'PENDING' } });
    if (!request) throw new BusinessRuleError('There is no pending approval request for this material request');
    return request;
  }

  /** Same authority test the approval engine applies, so quantities are never touched by someone who then gets refused. */
  private assertMayDecide(user: SessionUser, request: { stepRoles: Prisma.JsonValue; currentStep: number; requestedById: string }): void {
    if (user.isSuperAdmin) return;
    const role = (request.stepRoles as string[])[request.currentStep - 1];
    if (!role || !user.roles.includes(role)) throw new ForbiddenException(`Step ${request.currentStep} requires the ${role ?? 'unknown'} role`);
    if (request.requestedById === user.id) throw new ForbiddenException('You cannot approve your own request');
  }

  private async resolveLines(
    db: Db,
    companyId: string,
    projectId: string,
    input: { lines: MaterialRequestLineInput[]; wbsNodeId?: string | null; costCodeId?: string | null },
  ): Promise<{ data: Prisma.MaterialRequestLineUncheckedCreateWithoutRequestInput[]; estimated: Prisma.Decimal }> {
    const items = await loadItems(db, companyId, input.lines.map((l) => l.itemId));
    const issues: LineIssue[] = [];
    const data: Prisma.MaterialRequestLineUncheckedCreateWithoutRequestInput[] = [];
    let estimated = ZERO;
    input.lines.forEach((l, i) => {
      const at = (f: string) => `lines.${i}.${f}`;
      const item = items.get(l.itemId);
      if (!item) return void issues.push({ path: at('itemId'), message: 'Item not found in this company' });
      if (!item.active) issues.push({ path: at('itemId'), message: `Item ${item.sku} is inactive` });
      if (item.restrictedProjectId && item.restrictedProjectId !== projectId) issues.push({ path: at('itemId'), message: `Item ${item.sku} is restricted to another project` });
      const unit = resolveUnit(item, l.unit, 'issue');
      if (!unit) return void issues.push({ path: at('unit'), message: `Unit ${l.unit} is not defined for item ${item.sku}` });
      const cost = item.costingMethod === 'STANDARD' || item.lastPurchaseCost.isZero() ? item.standardCost : item.lastPurchaseCost;
      estimated = estimated.plus(toBaseQty(dec(l.qty), factorFor(item, unit)).mul(cost));
      data.push({
        lineNo: i + 1, itemId: l.itemId, qty: l.qty, approvedQty: l.qty, unit, purpose: l.purpose ?? null,
        wbsNodeId: l.wbsNodeId ?? input.wbsNodeId ?? null, costCodeId: l.costCodeId ?? input.costCodeId ?? null, boqItemId: l.boqItemId ?? null,
      });
    });
    throwIfIssues('One or more request lines are invalid', issues);
    await this.dimensions.assertLines(db, companyId, projectId, data.map((d, i) => ({ path: `lines.${i}`, wbsNodeId: d.wbsNodeId, costCodeId: d.costCodeId, boqItemId: d.boqItemId })));
    return { data, estimated: round2(estimated) };
  }

  private async load(user: SessionUser, id: string, action: Action) {
    const doc = await this.prisma.materialRequest.findFirst({ where: { id, companyId: user.companyId, deletedAt: null } });
    if (!doc) throw new NotFoundError('Material request', id);
    this.access.assertCan(user, MODULE, action, { projectId: doc.projectId, warehouseId: doc.warehouseId });
    return doc;
  }

  private async lock(tx: Db, id: string) {
    await tx.$queryRaw`SELECT id FROM "MaterialRequest" WHERE id = ${id} FOR UPDATE`;
    return tx.materialRequest.findUniqueOrThrow({ where: { id } });
  }
}
