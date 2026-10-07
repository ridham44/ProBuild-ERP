import { Injectable, OnModuleInit } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { REQUISITION_SORT_FIELDS } from '@probuild/shared';
import type { CreateRequisitionInput, RequisitionListQuery, SessionUser, UpdateRequisitionInput } from '@probuild/shared';
import { AccessService } from '../../common/access.service';
import { AuditedService } from '../../common/audited-service';
import { BusinessRuleError, NotFoundError } from '../../common/errors/domain-errors';
import { buildOrderBy, containsAny, dateRange } from '../../common/list';
import { nonNegative, ZERO } from '../../common/money';
import { paginate } from '../../common/pagination';
import { ProjectAccessService } from '../../common/project-access.service';
import { ActivityService } from '../../engines/activity/activity.service';
import { ApprovalsService } from '../../engines/approvals/approvals.service';
import { AuditService } from '../../engines/audit/audit.service';
import { NotificationsService } from '../../engines/notifications/notifications.service';
import { NumberingService } from '../../engines/numbering/numbering.service';
import { Db, PrismaService } from '../../prisma/prisma.service';
import { ProcurementValidator, ResolvedRequisitionLine } from './procurement-validation';

const DOC = 'PURCHASE_REQUISITION';
const MODULE = 'procurement.requisition';
const LINE_INCLUDE = {
  item: { select: { id: true, sku: true, name: true, baseUnit: true } },
  warehouse: { select: { id: true, code: true, name: true } },
  wbsNode: { select: { id: true, code: true, name: true } },
  costCode: { select: { id: true, code: true, name: true } },
  boqItem: { select: { id: true, itemNo: true, description: true } },
} satisfies Prisma.PurchaseRequisitionLineInclude;

type Meta = { ip?: string; userAgent?: string };

/**
 * Purchase requisition workflow:
 *   DRAFT -> SUBMITTED -> APPROVED | REJECTED   (no approval workflow for the amount => DRAFT -> APPROVED)
 *   APPROVED -> PARTIALLY_ORDERED -> ORDERED     (driven by purchase orders, see requisition-ordering.ts)
 *   DRAFT | SUBMITTED | APPROVED -> CANCELLED    APPROVED | PARTIALLY_ORDERED | ORDERED -> CLOSED
 * Any other move is a 422.
 */
@Injectable()
export class RequisitionsService extends AuditedService implements OnModuleInit {
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
    // Runs inside the deciding transaction, so the decision and the document status change together.
    this.approvals.registerHandler(DOC, {
      onApproved: async (db, request) => {
        const moved = await db.purchaseRequisition.updateMany({
          where: { id: request.documentId, companyId: request.companyId, status: 'SUBMITTED' },
          data: { status: 'APPROVED', approvedAt: new Date() },
        });
        if (!(await this.settledOrMissing(db, request.documentId, request.companyId, moved.count))) return;
        await this.audit.record(db, {
          companyId: request.companyId, userId: null, entityType: DOC, entityId: request.documentId,
          action: 'STATUS_CHANGE', before: { status: 'SUBMITTED' }, after: { status: 'APPROVED' },
        });
        await this.notifications.notifyRole('Procurement', {
          companyId: request.companyId, type: 'PR_APPROVED', title: `Requisition ${request.documentNo ?? ''} approved: ready for sourcing`.trim(),
          entityType: DOC, entityId: request.documentId,
        }, db);
      },
      onRejected: async (db, request) => {
        const moved = await db.purchaseRequisition.updateMany({
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

  /**
   * An approval decision must only move a document that is still awaiting it. A decision for a document id
   * that no longer exists (nothing to move) is a no-op; one for a document in any other state fails the decision.
   */
  private async settledOrMissing(db: Db, id: string, companyId: string, moved: number): Promise<boolean> {
    if (moved === 1) return true;
    const doc = await db.purchaseRequisition.findFirst({ where: { id, companyId }, select: { status: true } });
    if (!doc) return false;
    throw new BusinessRuleError('The requisition is no longer awaiting approval');
  }

  // ---- Queries -----------------------------------------------------------------------------------

  list(user: SessionUser, query: RequisitionListQuery) {
    const where: Prisma.PurchaseRequisitionWhereInput = {
      companyId: user.companyId,
      deletedAt: null,
      ...this.access.projectWhere(user, MODULE, 'VIEW'),
      ...(query.projectId ? { projectId: query.projectId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.requesterId ? { requesterId: query.requesterId } : {}),
      ...(query.priority ? { priority: query.priority } : {}),
      ...(dateRange(query.from, query.to) ? { createdAt: dateRange(query.from, query.to) } : {}),
      ...containsAny(query.search, ['number', 'purpose', 'remarks']),
    };
    return paginate(
      (args) =>
        this.prisma.purchaseRequisition.findMany({
          where,
          orderBy: buildOrderBy(query.sort, REQUISITION_SORT_FIELDS, [{ createdAt: 'desc' }]),
          include: { project: { select: { id: true, code: true, name: true } }, _count: { select: { lines: true } } },
          ...args,
        }),
      query,
    );
  }

  async get(user: SessionUser, id: string) {
    const pr = await this.load(user, id, 'VIEW');
    const [lines, project, requester, rfqs, orders, approvals] = await Promise.all([
      this.prisma.purchaseRequisitionLine.findMany({ where: { requisitionId: id }, orderBy: { lineNo: 'asc' }, include: LINE_INCLUDE }),
      this.prisma.project.findUniqueOrThrow({ where: { id: pr.projectId }, select: { id: true, code: true, name: true, status: true } }),
      this.prisma.user.findUnique({ where: { id: pr.requesterId }, select: { id: true, name: true } }),
      this.prisma.rfq.findMany({ where: { requisitionId: id, deletedAt: null }, select: { id: true, number: true, status: true, dueDate: true }, orderBy: { createdAt: 'asc' } }),
      this.prisma.purchaseOrder.findMany({
        where: { requisitionId: id, deletedAt: null },
        select: { id: true, number: true, status: true, totalAmount: true, supplier: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'asc' },
      }),
      this.activity.approvalsFor(user.companyId, DOC, id),
    ]);
    return {
      ...pr,
      project,
      requester,
      lines: lines.map((l) => ({ ...l, remainingQty: nonNegative(l.qty.minus(l.orderedQty)).toString(), estimatedAmount: l.qty.mul(l.estimatedUnitCost).toDecimalPlaces(2).toString() })),
      rfqs,
      purchaseOrders: orders,
      approvals,
    };
  }

  async activityFor(user: SessionUser, id: string) {
    await this.load(user, id, 'VIEW');
    return this.activity.forDocument({ companyId: user.companyId, entityType: DOC, entityId: id, approvalType: DOC });
  }

  // ---- Commands ----------------------------------------------------------------------------------

  async create(user: SessionUser, input: CreateRequisitionInput) {
    const project = await this.projectAccess.load(user, input.projectId, MODULE, 'CREATE');
    this.projectAccess.assertActive(project);
    await this.validator.assertWarehouse(this.prisma, user.companyId, input.warehouseId);
    const resolved = await this.validator.resolveRequisitionLines(this.prisma, { companyId: user.companyId, projectId: project.id }, input.lines);
    const id = await this.prisma.$transaction(async (tx) => {
      const number = await this.numbering.next(tx, user.companyId, DOC);
      const created = await tx.purchaseRequisition.create({
        data: {
          companyId: user.companyId,
          number,
          projectId: project.id,
          warehouseId: input.warehouseId ?? null,
          requesterId: user.id,
          priority: input.priority ?? 'NORMAL',
          requiredDate: input.requiredDate ?? null,
          purpose: input.purpose ?? null,
          remarks: input.remarks ?? null,
          estimatedTotal: this.total(resolved),
          lines: { create: this.lineData(resolved) },
        },
      });
      await this.audit.record(tx, {
        companyId: user.companyId, userId: user.id, entityType: DOC, entityId: created.id,
        action: 'CREATE', after: { number, projectId: project.id, estimatedTotal: created.estimatedTotal, lineCount: resolved.length },
      });
      return created.id;
    });
    return this.get(user, id);
  }

  async update(user: SessionUser, id: string, input: UpdateRequisitionInput) {
    const preview = await this.load(user, id, 'EDIT');
    const resolved = input.lines
      ? await this.validator.resolveRequisitionLines(this.prisma, { companyId: user.companyId, projectId: preview.projectId }, input.lines)
      : null;
    if (input.warehouseId) await this.validator.assertWarehouse(this.prisma, user.companyId, input.warehouseId);
    await this.prisma.$transaction(async (tx) => {
      const before = await this.lockForUpdate(tx, id);
      if (before.status !== 'DRAFT') throw new BusinessRuleError(`A ${before.status} requisition cannot be edited; only drafts can`);
      const header = { warehouseId: input.warehouseId, priority: input.priority, requiredDate: input.requiredDate, purpose: input.purpose, remarks: input.remarks };
      if (resolved) await tx.purchaseRequisitionLine.deleteMany({ where: { requisitionId: id } });
      const after = await tx.purchaseRequisition.update({
        where: { id },
        data: {
          ...header,
          ...(resolved ? { estimatedTotal: this.total(resolved), lines: { create: this.lineData(resolved) } } : {}),
        },
      });
      await this.audit.record(tx, {
        companyId: user.companyId, userId: user.id, entityType: DOC, entityId: id, action: 'UPDATE',
        before: { requiredDate: before.requiredDate, purpose: before.purpose, remarks: before.remarks, priority: before.priority, warehouseId: before.warehouseId, estimatedTotal: before.estimatedTotal },
        after: { ...header, ...(resolved ? { estimatedTotal: after.estimatedTotal, lines: resolved.length } : {}) },
      });
    });
    return this.get(user, id);
  }

  async submit(user: SessionUser, id: string) {
    const preview = await this.load(user, id, 'SUBMIT');
    const project = await this.projectAccess.load(user, preview.projectId, MODULE, 'SUBMIT');
    this.projectAccess.assertActive(project);
    await this.prisma.$transaction(async (tx) => {
      const pr = await this.lockForUpdate(tx, id);
      if (pr.status !== 'DRAFT') throw new BusinessRuleError(`A ${pr.status} requisition cannot be submitted; only drafts can`);
      const lines = await tx.purchaseRequisitionLine.findMany({ where: { requisitionId: id }, select: { qty: true, estimatedUnitCost: true, item: { select: { active: true, sku: true } } } });
      if (lines.length === 0) throw new BusinessRuleError('A requisition needs at least one line');
      const inactive = lines.find((l) => !l.item.active);
      if (inactive) throw new BusinessRuleError(`Item ${inactive.item.sku} is inactive; remove it before submitting`);

      const result = await this.approvals.submit(tx, {
        companyId: user.companyId, documentType: DOC, documentId: id, documentNo: pr.number,
        projectId: pr.projectId, amount: pr.estimatedTotal, requestedById: user.id,
      });
      const now = new Date();
      if (result.required) {
        await tx.purchaseRequisition.update({ where: { id }, data: { status: 'SUBMITTED', submittedAt: now } });
        await this.audit.record(tx, {
          companyId: user.companyId, userId: user.id, entityType: DOC, entityId: id, action: 'SUBMIT',
          before: { status: 'DRAFT' }, after: { status: 'SUBMITTED', approvalRequestId: result.request.id, amount: pr.estimatedTotal, steps: result.request.totalSteps },
        });
      } else {
        await tx.purchaseRequisition.update({ where: { id }, data: { status: 'APPROVED', submittedAt: now, approvedAt: now } });
        await this.audit.record(tx, {
          companyId: user.companyId, userId: user.id, entityType: DOC, entityId: id, action: 'AUTO_APPROVE',
          before: { status: 'DRAFT' }, after: { status: 'APPROVED', amount: pr.estimatedTotal },
        });
        await this.notifications.notifyRole('Procurement', {
          companyId: user.companyId, type: 'PR_APPROVED', title: `Requisition ${pr.number} approved: ready for sourcing`, entityType: DOC, entityId: id,
        }, tx);
      }
    });
    return this.get(user, id);
  }

  async approve(user: SessionUser, id: string, comment: string | undefined, meta: Meta) {
    return this.decide(user, id, 'APPROVED', comment, meta);
  }

  async reject(user: SessionUser, id: string, comment: string, meta: Meta) {
    return this.decide(user, id, 'REJECTED', comment, meta);
  }

  async cancel(user: SessionUser, id: string, reason: string) {
    await this.load(user, id, 'CANCEL');
    await this.prisma.$transaction(async (tx) => {
      const pr = await this.lockForUpdate(tx, id);
      if (!['DRAFT', 'SUBMITTED', 'APPROVED'].includes(pr.status)) {
        throw new BusinessRuleError(
          pr.status === 'PARTIALLY_ORDERED' || pr.status === 'ORDERED'
            ? 'This requisition already has purchase orders; cancel those first or close the requisition'
            : `A ${pr.status} requisition cannot be cancelled`,
        );
      }
      const liveRfqs = await tx.rfq.count({ where: { requisitionId: id, deletedAt: null, status: { in: ['DRAFT', 'SENT', 'QUOTED', 'AWARDED'] } } });
      if (liveRfqs > 0) throw new BusinessRuleError('Cancel or close the requisition\'s RFQs first');
      if (pr.status === 'SUBMITTED') await this.approvals.cancel(tx, user.companyId, DOC, id);
      await tx.purchaseRequisition.update({ where: { id }, data: { status: 'CANCELLED', cancelledAt: new Date(), cancelReason: reason } });
      await this.audit.record(tx, {
        companyId: user.companyId, userId: user.id, entityType: DOC, entityId: id, action: 'CANCEL',
        before: { status: pr.status }, after: { status: 'CANCELLED' }, reason,
      });
    });
    return this.get(user, id);
  }

  /** Closing drops whatever has not been ordered yet; ordered quantities stay on their purchase orders. */
  async close(user: SessionUser, id: string, reason: string) {
    await this.load(user, id, 'CLOSE');
    await this.prisma.$transaction(async (tx) => {
      const pr = await this.lockForUpdate(tx, id);
      if (!['APPROVED', 'PARTIALLY_ORDERED', 'ORDERED'].includes(pr.status)) {
        throw new BusinessRuleError(`A ${pr.status} requisition cannot be closed; only approved or ordered ones can`);
      }
      const pending = await tx.purchaseOrder.count({ where: { requisitionId: id, deletedAt: null, status: { in: ['DRAFT', 'PENDING_APPROVAL'] } } });
      if (pending > 0) throw new BusinessRuleError('Resolve the requisition\'s draft or pending purchase orders before closing it');
      const openRfqs = await tx.rfq.count({ where: { requisitionId: id, deletedAt: null, status: { in: ['DRAFT', 'SENT', 'QUOTED'] } } });
      if (openRfqs > 0) throw new BusinessRuleError('Cancel or close the requisition\'s open RFQs first');
      await tx.purchaseRequisition.update({ where: { id }, data: { status: 'CLOSED', closedAt: new Date(), closeReason: reason } });
      await this.audit.record(tx, {
        companyId: user.companyId, userId: user.id, entityType: DOC, entityId: id, action: 'CLOSE',
        before: { status: pr.status }, after: { status: 'CLOSED' }, reason,
      });
    });
    return this.get(user, id);
  }

  // ---- helpers -----------------------------------------------------------------------------------

  private async decide(user: SessionUser, id: string, decision: 'APPROVED' | 'REJECTED', comment: string | undefined, meta: Meta) {
    const pr = await this.load(user, id, 'VIEW');
    if (pr.status !== 'SUBMITTED') throw new BusinessRuleError(`A ${pr.status} requisition is not awaiting approval`);
    const request = await this.prisma.approvalRequest.findFirst({
      where: { companyId: user.companyId, documentType: DOC, documentId: id, status: 'PENDING' },
      select: { id: true },
    });
    if (!request) throw new BusinessRuleError('There is no pending approval request for this requisition');
    await this.approvals.decide(user, request.id, decision, { comment }, meta);
    return this.get(user, id);
  }

  private total(lines: ResolvedRequisitionLine[]): Prisma.Decimal {
    return lines.reduce((sum, l) => sum.plus(l.estimatedAmount), ZERO);
  }

  private lineData(lines: ResolvedRequisitionLine[]): Prisma.PurchaseRequisitionLineUncheckedCreateWithoutRequisitionInput[] {
    return lines.map((l, i) => ({
      lineNo: i + 1,
      itemId: l.item.id,
      description: l.input.description ?? null,
      justification: l.input.justification ?? null,
      warehouseId: l.input.warehouseId ?? null,
      wbsNodeId: l.input.wbsNodeId ?? null,
      costCodeId: l.input.costCodeId ?? null,
      boqItemId: l.input.boqItemId ?? null,
      qty: l.input.qty,
      unit: l.unit,
      estimatedUnitCost: l.estimatedUnitCost,
      requiredDate: l.input.requiredDate ?? null,
    }));
  }

  /** Loads the requisition inside the company, enforcing project scope for the action. */
  private async load(user: SessionUser, id: string, action: 'VIEW' | 'EDIT' | 'SUBMIT' | 'CANCEL' | 'CLOSE') {
    const pr = await this.prisma.purchaseRequisition.findFirst({ where: { id, companyId: user.companyId, deletedAt: null } });
    if (!pr) throw new NotFoundError('Purchase requisition', id);
    this.access.assertCan(user, MODULE, action, { projectId: pr.projectId });
    return pr;
  }

  private async lockForUpdate(tx: Db, id: string) {
    await tx.$queryRaw`SELECT id FROM "PurchaseRequisition" WHERE id = ${id} FOR UPDATE`;
    return tx.purchaseRequisition.findUniqueOrThrow({ where: { id } });
  }
}
