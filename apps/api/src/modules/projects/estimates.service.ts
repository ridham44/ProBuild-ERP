import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  BoqListQuery,
  CreateBoqItemInput,
  CreateEstimateInput,
  PaginationQuery,
  SessionUser,
  UpdateBoqItemInput,
  UpdateEstimateInput,
} from '@probuild/shared';
import { AccessService } from '../../common/access.service';
import { AuditedService } from '../../common/audited-service';
import { BusinessRuleError, NotFoundError } from '../../common/errors/domain-errors';
import { containsAny } from '../../common/list';
import { dec, estimateTotals, round2 } from '../../common/money';
import { paginate } from '../../common/pagination';
import { ProjectAccessService } from '../../common/project-access.service';
import { ActivityService } from '../../engines/activity/activity.service';
import { AuditService } from '../../engines/audit/audit.service';
import { Db, PrismaService } from '../../prisma/prisma.service';
import { WbsService } from './wbs.service';

const COST_FIELD = {
  MATERIAL: 'materialCost',
  LABOR: 'laborCost',
  EQUIPMENT: 'equipmentCost',
  SUBCONTRACT: 'subcontractCost',
  OTHER: null,
} as const;

/** Estimate -> BOQ items -> (on approval) the project's control Budget with one BudgetLine per BOQ item. */
@Injectable()
export class EstimatesService extends AuditedService {
  constructor(
    prisma: PrismaService,
    audit: AuditService,
    private readonly access: AccessService,
    private readonly projectAccess: ProjectAccessService,
    private readonly activity: ActivityService,
  ) {
    super(prisma, audit);
  }

  // ---- Estimates ---------------------------------------------------------------------------------

  async listEstimates(user: SessionUser, projectId: string, query: PaginationQuery) {
    await this.projectAccess.load(user, projectId, 'projects.estimate', 'VIEW');
    return paginate(
      (args) =>
        this.prisma.estimate.findMany({
          where: { projectId, companyId: user.companyId, deletedAt: null },
          orderBy: [{ version: 'desc' }, { id: 'asc' }],
          include: { _count: { select: { items: { where: { deletedAt: null } } } } },
          ...args,
        }),
      query,
    );
  }

  async getEstimate(user: SessionUser, id: string) {
    const estimate = await this.loadEstimate(user, id, 'VIEW');
    const itemCount = await this.prisma.boqItem.count({ where: { estimateId: id, deletedAt: null } });
    return { ...estimate, itemCount };
  }

  async createEstimate(user: SessionUser, projectId: string, input: CreateEstimateInput) {
    const project = await this.projectAccess.load(user, projectId, 'projects.estimate', 'CREATE');
    this.projectAccess.assertNotEnded(project);
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Project" WHERE id = ${projectId} FOR UPDATE`;
      const latest = await tx.estimate.aggregate({ where: { projectId }, _max: { version: true } });
      const created = await tx.estimate.create({
        data: { ...input, companyId: user.companyId, projectId, version: (latest._max.version ?? 0) + 1 },
      });
      await this.audit.record(tx, { companyId: user.companyId, userId: user.id, entityType: 'Estimate', entityId: created.id, action: 'CREATE', after: created });
      return created;
    });
  }

  async updateEstimate(user: SessionUser, id: string, input: UpdateEstimateInput) {
    const before = await this.loadEstimate(user, id, 'EDIT');
    this.assertDraft(before);
    return this.prisma.$transaction(async (tx) => {
      await tx.estimate.update({ where: { id }, data: input });
      const after = await this.recompute(tx, id);
      await this.audit.record(tx, { companyId: user.companyId, userId: user.id, entityType: 'Estimate', entityId: id, action: 'UPDATE', before, after });
      return after;
    });
  }

  // ---- BOQ items ---------------------------------------------------------------------------------

  async listBoq(user: SessionUser, projectId: string, query: BoqListQuery) {
    await this.projectAccess.load(user, projectId, 'projects.boq', 'VIEW');
    const where: Prisma.BoqItemWhereInput = {
      projectId,
      companyId: user.companyId,
      deletedAt: null,
      // Without an explicit estimate the BOQ is the approved (control) one.
      ...(query.estimateId ? { estimateId: query.estimateId } : { estimate: { status: 'APPROVED' } }),
      ...(query.wbsNodeId ? { wbsNodeId: query.wbsNodeId } : {}),
      ...(query.costCodeId ? { costCodeId: query.costCodeId } : {}),
      ...containsAny(query.search, ['itemNo', 'description', 'section']),
    };
    return paginate(
      (args) =>
        this.prisma.boqItem.findMany({
          where,
          orderBy: [{ sortOrder: 'asc' }, { itemNo: 'asc' }, { id: 'asc' }],
          include: { wbsNode: { select: { id: true, code: true, name: true } }, costCode: { select: { id: true, code: true, name: true } } },
          ...args,
        }),
      query,
    );
  }

  async addBoqItem(user: SessionUser, estimateId: string, input: CreateBoqItemInput) {
    const estimate = await this.loadEstimate(user, estimateId, 'EDIT', 'projects.boq');
    this.access.assertCan(user, 'projects.boq', 'CREATE', { projectId: estimate.projectId });
    this.assertDraft(estimate);
    await this.assertRefs(user, estimate.projectId, input);
    return this.prisma.$transaction(async (tx) => {
      const sort = await tx.boqItem.aggregate({ where: { estimateId }, _max: { sortOrder: true } });
      const created = await tx.boqItem.create({
        data: {
          ...this.money(input),
          quantity: input.quantity,
          unitRate: input.unitRate,
          companyId: user.companyId,
          projectId: estimate.projectId,
          estimateId,
          section: input.section ?? null,
          itemNo: input.itemNo,
          description: input.description,
          unit: input.unit,
          costCategory: input.costCategory ?? 'MATERIAL',
          wbsNodeId: input.wbsNodeId ?? null,
          costCodeId: input.costCodeId ?? null,
          sortOrder: (sort._max.sortOrder ?? 0) + 1,
        },
      });
      await this.recompute(tx, estimateId);
      await this.audit.record(tx, { companyId: user.companyId, userId: user.id, entityType: 'Estimate', entityId: estimateId, action: 'BOQ_ITEM_ADDED', after: { boqItemId: created.id, itemNo: created.itemNo, amount: created.amount } });
      return created;
    });
  }

  async updateBoqItem(user: SessionUser, id: string, input: UpdateBoqItemInput) {
    const before = await this.loadBoqItem(user, id, 'EDIT');
    const estimate = await this.prisma.estimate.findUniqueOrThrow({ where: { id: before.estimateId } });
    this.assertDraft(estimate);
    await this.assertRefs(user, before.projectId, input);
    return this.prisma.$transaction(async (tx) => {
      const qty = input.quantity ?? before.quantity.toString();
      const rate = input.unitRate ?? before.unitRate.toString();
      const category = input.costCategory ?? before.costCategory;
      const after = await tx.boqItem.update({
        where: { id },
        data: { ...input, ...this.money({ quantity: qty, unitRate: rate, costCategory: category }), costCategory: category },
      });
      await this.recompute(tx, before.estimateId);
      await this.audit.record(tx, { companyId: user.companyId, userId: user.id, entityType: 'Estimate', entityId: before.estimateId, action: 'BOQ_ITEM_UPDATED', after: { boqItemId: id, itemNo: after.itemNo, amount: after.amount } });
      return after;
    });
  }

  async removeBoqItem(user: SessionUser, id: string) {
    const before = await this.loadBoqItem(user, id, 'DELETE');
    const estimate = await this.prisma.estimate.findUniqueOrThrow({ where: { id: before.estimateId } });
    this.assertDraft(estimate);
    await this.prisma.$transaction(async (tx) => {
      await tx.boqItem.update({ where: { id }, data: { deletedAt: new Date(), itemNo: `${before.itemNo}~del~${id.slice(0, 8)}` } });
      await this.recompute(tx, before.estimateId);
      await this.audit.record(tx, { companyId: user.companyId, userId: user.id, entityType: 'Estimate', entityId: before.estimateId, action: 'BOQ_ITEM_REMOVED', after: { boqItemId: id, itemNo: before.itemNo } });
    });
  }

  // ---- Approval -> budget ------------------------------------------------------------------------

  /**
   * Approving an estimate freezes it and creates the next Budget version: one BudgetLine per BOQ item.
   * An earlier approved estimate for the project is superseded (CLOSED) and its budget stops being current.
   */
  async approveEstimate(user: SessionUser, id: string) {
    const preview = await this.loadEstimate(user, id, 'APPROVE');
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Project" WHERE id = ${preview.projectId} FOR UPDATE`;
      const estimate = await tx.estimate.findUniqueOrThrow({ where: { id } });
      this.assertDraft(estimate);
      const project = await tx.project.findUniqueOrThrow({ where: { id: estimate.projectId } });
      this.projectAccess.assertNotEnded(project);
      const items = await tx.boqItem.findMany({ where: { estimateId: id, deletedAt: null }, orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] });
      if (items.length === 0) throw new BusinessRuleError('An estimate needs at least one BOQ item before it can be approved');

      const totals = await this.recompute(tx, id);
      await tx.estimate.updateMany({ where: { projectId: estimate.projectId, status: 'APPROVED', id: { not: id } }, data: { status: 'CLOSED' } });
      const approved = await tx.estimate.update({ where: { id }, data: { status: 'APPROVED', approvedAt: new Date(), approvedById: user.id } });

      const latest = await tx.budget.aggregate({ where: { projectId: estimate.projectId }, _max: { version: true } });
      await tx.budget.updateMany({ where: { projectId: estimate.projectId, isCurrent: true }, data: { isCurrent: false } });
      const version = (latest._max.version ?? 0) + 1;
      const budget = await tx.budget.create({
        data: {
          companyId: user.companyId,
          projectId: estimate.projectId,
          version,
          isCurrent: true,
          isOriginal: version === 1,
          reason: `Approved estimate v${estimate.version}`,
          totalAmount: totals.directCost,
          createdById: user.id,
          lines: {
            create: items.map((i) => ({
              projectId: estimate.projectId,
              wbsNodeId: i.wbsNodeId,
              boqItemId: i.id,
              costCodeId: i.costCodeId,
              category: i.costCategory,
              quantity: i.quantity,
              amount: i.amount,
            })),
          },
        },
        include: { lines: true },
      });
      await this.audit.record(tx, {
        companyId: user.companyId, userId: user.id, entityType: 'Estimate', entityId: id,
        action: 'APPROVE', before: { status: 'DRAFT' }, after: { status: 'APPROVED', budgetId: budget.id, budgetVersion: version, budgetTotal: budget.totalAmount },
      });
      return { estimate: approved, budget };
    });
  }

  async currentBudget(user: SessionUser, projectId: string, version?: number) {
    await this.projectAccess.load(user, projectId, 'projects.budget', 'VIEW');
    const budget = await this.prisma.budget.findFirst({
      where: { projectId, companyId: user.companyId, ...(version ? { version } : { isCurrent: true }) },
      include: {
        lines: {
          orderBy: [{ boqItem: { sortOrder: 'asc' } }, { id: 'asc' }],
          include: {
            boqItem: { select: { id: true, itemNo: true, description: true, unit: true } },
            wbsNode: { select: { id: true, code: true, name: true } },
            costCode: { select: { id: true, code: true, name: true } },
          },
        },
      },
    });
    if (!budget) throw new NotFoundError('Budget');
    return budget;
  }

  async listBudgets(user: SessionUser, projectId: string) {
    await this.projectAccess.load(user, projectId, 'projects.budget', 'VIEW');
    return this.prisma.budget.findMany({
      where: { projectId, companyId: user.companyId },
      orderBy: { version: 'desc' },
      take: 100,
    });
  }

  async activityFor(user: SessionUser, id: string) {
    await this.loadEstimate(user, id, 'VIEW');
    return this.activity.forDocument({ companyId: user.companyId, entityType: 'Estimate', entityId: id });
  }

  // ---- helpers -----------------------------------------------------------------------------------

  private money(input: { quantity?: string; unitRate?: string; costCategory?: keyof typeof COST_FIELD }) {
    if (input.quantity === undefined || input.unitRate === undefined) return {};
    const amount = round2(dec(input.quantity).mul(dec(input.unitRate)));
    const field = COST_FIELD[input.costCategory ?? 'MATERIAL'];
    return {
      amount,
      materialCost: 0,
      laborCost: 0,
      equipmentCost: 0,
      subcontractCost: 0,
      ...(field ? { [field]: amount } : {}),
    };
  }

  /** Recomputes the estimate roll-up from its live BOQ items. */
  private async recompute(tx: Db, estimateId: string) {
    const estimate = await tx.estimate.findUniqueOrThrow({ where: { id: estimateId } });
    const items = await tx.boqItem.findMany({ where: { estimateId, deletedAt: null }, select: { amount: true } });
    const totals = estimateTotals(items.map((i) => i.amount), estimate);
    await tx.estimate.update({ where: { id: estimateId }, data: { directCost: totals.directCost, totalAmount: totals.total } });
    return totals;
  }

  private assertDraft(estimate: { status: string; version: number }): void {
    if (estimate.status !== 'DRAFT') throw new BusinessRuleError(`Estimate v${estimate.version} is ${estimate.status.toLowerCase()}; only draft estimates can be changed`);
  }

  private async loadEstimate(user: SessionUser, id: string, action: 'VIEW' | 'EDIT' | 'APPROVE', module = 'projects.estimate') {
    const estimate = await this.prisma.estimate.findFirst({ where: { id, companyId: user.companyId, deletedAt: null } });
    if (!estimate) throw new NotFoundError('Estimate', id);
    this.access.assertCan(user, module, action, { projectId: estimate.projectId });
    return estimate;
  }

  private async loadBoqItem(user: SessionUser, id: string, action: 'EDIT' | 'DELETE') {
    const item = await this.prisma.boqItem.findFirst({ where: { id, companyId: user.companyId, deletedAt: null } });
    if (!item) throw new NotFoundError('BOQ item', id);
    this.access.assertCan(user, 'projects.boq', action, { projectId: item.projectId });
    return item;
  }

  private async assertRefs(user: SessionUser, projectId: string, input: { wbsNodeId?: string | null; costCodeId?: string | null }): Promise<void> {
    await WbsService.assertInProject(this.prisma, projectId, input.wbsNodeId);
    if (input.costCodeId) {
      const cc = await this.prisma.costCode.findFirst({ where: { id: input.costCodeId, companyId: user.companyId, deletedAt: null, active: true }, select: { id: true } });
      if (!cc) throw new BusinessRuleError('Cost code not found in this company');
    }
  }
}
