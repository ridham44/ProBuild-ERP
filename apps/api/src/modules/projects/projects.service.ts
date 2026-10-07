import { ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PROJECT_SORT_FIELDS, PROJECT_TRANSITIONS } from '@probuild/shared';
import type {
  AddProjectMemberInput,
  CreateContractInput,
  CreateProjectInput,
  ProjectListQuery,
  ProjectStatusChangeInput,
  SessionUser,
  UpdateContractInput,
  UpdateProjectInput,
} from '@probuild/shared';
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
import { Db, PrismaService } from '../../prisma/prisma.service';

const OPEN_PO = ['APPROVED', 'SENT', 'PARTIALLY_RECEIVED'] as const;
const OPEN_PR = ['SUBMITTED', 'APPROVED', 'PARTIALLY_ORDERED'] as const;
const LIVE_PO = ['PENDING_APPROVAL', 'APPROVED', 'SENT', 'PARTIALLY_RECEIVED'] as const;

const PROJECT_INCLUDE = {
  customer: { select: { id: true, code: true, name: true } },
  manager: { select: { id: true, name: true } },
  branch: { select: { id: true, code: true, name: true } },
} satisfies Prisma.ProjectInclude;

@Injectable()
export class ProjectsService extends AuditedService {
  constructor(
    prisma: PrismaService,
    audit: AuditService,
    private readonly access: AccessService,
    private readonly projectAccess: ProjectAccessService,
    private readonly activity: ActivityService,
    private readonly numbering: NumberingService,
    private readonly costLedger: CostLedgerService,
  ) {
    super(prisma, audit);
  }

  // ---- Projects ----------------------------------------------------------------------------------

  list(user: SessionUser, query: ProjectListQuery) {
    const scope = this.access.projectScope(user, 'projects.project', 'VIEW');
    const where: Prisma.ProjectWhereInput = {
      companyId: user.companyId,
      deletedAt: null,
      ...(scope === 'ALL' ? {} : { id: { in: scope } }),
      ...containsAny(query.search, ['code', 'name', 'location']),
      ...(query.status ? { status: query.status } : {}),
      ...(query.customerId ? { customerId: query.customerId } : {}),
      ...(query.branchId ? { branchId: query.branchId } : {}),
      ...(query.managerId ? { managerId: query.managerId } : {}),
    };
    return paginate(
      (args) =>
        this.prisma.project.findMany({
          where,
          orderBy: buildOrderBy(query.sort, PROJECT_SORT_FIELDS, [{ code: 'asc' }]),
          include: PROJECT_INCLUDE,
          ...args,
        }),
      query,
    );
  }

  async get(user: SessionUser, id: string) {
    await this.projectAccess.load(user, id, 'projects.project', 'VIEW');
    const project = await this.prisma.project.findUniqueOrThrow({
      where: { id },
      include: {
        ...PROJECT_INCLUDE,
        projectMembers: { include: { user: { select: { id: true, name: true } } }, orderBy: { createdAt: 'asc' } },
      },
    });
    const activeContract = await this.prisma.contract.findFirst({ where: { projectId: id, status: 'APPROVED', deletedAt: null } });
    return { ...project, activeContract };
  }

  async create(user: SessionUser, input: CreateProjectInput) {
    if (this.access.projectScope(user, 'projects.project', 'CREATE') !== 'ALL') {
      throw new ForbiddenException('Creating a project requires company-wide project permission');
    }
    await this.assertRefs(user, input);
    return this.createAudited(user, 'Project', (tx) => tx.project.create({ data: { ...input, companyId: user.companyId } }));
  }

  async update(user: SessionUser, id: string, input: UpdateProjectInput) {
    const before = await this.projectAccess.load(user, id, 'projects.project', 'EDIT');
    this.projectAccess.assertNotEnded(before);
    await this.assertRefs(user, input);
    const start = input.startDate === undefined ? before.startDate : input.startDate;
    const end = input.originalEndDate === undefined ? before.originalEndDate : input.originalEndDate;
    if (start && end && end < start) throw new BusinessRuleError('originalEndDate must not precede startDate');
    if (input.contractAmount !== undefined) {
      const active = await this.prisma.contract.count({ where: { projectId: id, status: 'APPROVED', deletedAt: null } });
      if (active > 0) throw new BusinessRuleError('The contract amount is managed by the active contract');
    }
    return this.updateAudited(user, 'Project', before, (tx) => tx.project.update({ where: { id }, data: input }));
  }

  async changeStatus(user: SessionUser, id: string, input: ProjectStatusChangeInput) {
    await this.projectAccess.load(user, id, 'projects.project', input.status === 'CLOSED' ? 'CLOSE' : 'EDIT');
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Project" WHERE id = ${id} FOR UPDATE`;
      const project = await tx.project.findUniqueOrThrow({ where: { id } });
      const allowed = PROJECT_TRANSITIONS[project.status];
      if (!allowed.includes(input.status)) {
        throw new BusinessRuleError(
          `A ${project.status} project cannot move to ${input.status}` + (allowed.length ? ` (allowed: ${allowed.join(', ')})` : ' (terminal state)'),
        );
      }
      if (input.status === 'ACTIVE' && !project.startDate) throw new BusinessRuleError('A start date is required before a project can be activated');
      if (['ON_HOLD', 'CANCELLED'].includes(input.status) && !input.reason) throw new BusinessRuleError(`A reason is required to move a project to ${input.status}`);
      if (input.status === 'COMPLETED' || input.status === 'CLOSED' || input.status === 'CANCELLED') await this.assertNoOpenProcurement(tx, id, input.status);

      const updated = await tx.project.update({ where: { id }, data: { status: input.status } });
      await this.audit.record(tx, {
        companyId: user.companyId,
        userId: user.id,
        entityType: 'Project',
        entityId: id,
        action: 'STATUS_CHANGE',
        before: { status: project.status },
        after: { status: updated.status },
        reason: input.reason,
      });
      return updated;
    });
  }

  async remove(user: SessionUser, id: string) {
    const before = await this.projectAccess.load(user, id, 'projects.project', 'DELETE');
    if (before.status !== 'PIPELINE') throw new BusinessRuleError('Only pipeline projects can be deleted; cancel or close the project instead');
    const [requisitions, orders, wbs, estimates, ledger] = await Promise.all([
      this.prisma.purchaseRequisition.count({ where: { projectId: id } }),
      this.prisma.purchaseOrder.count({ where: { projectId: id } }),
      this.prisma.wbsNode.count({ where: { projectId: id, deletedAt: null } }),
      this.prisma.estimate.count({ where: { projectId: id, deletedAt: null } }),
      this.prisma.projectCostLedger.count({ where: { projectId: id } }),
    ]);
    if (requisitions + orders + wbs + estimates + ledger > 0) {
      throw new BusinessRuleError('This project already has documents, WBS or estimates; cancel it instead of deleting');
    }
    await this.softDeleteAudited(user, 'Project', before, (tx) => tx.project.update({ where: { id }, data: { deletedAt: new Date() } }));
  }

  // ---- Team --------------------------------------------------------------------------------------

  async listMembers(user: SessionUser, projectId: string) {
    await this.projectAccess.load(user, projectId, 'projects.project', 'VIEW');
    return this.prisma.projectMember.findMany({
      where: { projectId },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'asc' },
      take: 200,
    });
  }

  async addMember(user: SessionUser, projectId: string, input: AddProjectMemberInput) {
    await this.projectAccess.load(user, projectId, 'projects.project', 'EDIT').then((p) => this.projectAccess.assertNotEnded(p));
    const member = await this.prisma.user.findFirst({ where: { id: input.userId, companyId: user.companyId, deletedAt: null, active: true }, select: { id: true, name: true } });
    if (!member) throw new BusinessRuleError('User not found in this company');
    return this.prisma.$transaction(async (tx) => {
      const created = await tx.projectMember.create({ data: { projectId, userId: input.userId, role: input.role } });
      await this.audit.record(tx, {
        companyId: user.companyId, userId: user.id, entityType: 'Project', entityId: projectId,
        action: 'MEMBER_ADDED', after: { userId: member.id, name: member.name, role: input.role },
      });
      return created;
    });
  }

  async updateMember(user: SessionUser, projectId: string, memberId: string, role: string) {
    await this.projectAccess.load(user, projectId, 'projects.project', 'EDIT');
    const before = await this.prisma.projectMember.findFirst({ where: { id: memberId, projectId } });
    if (!before) throw new NotFoundError('Project member', memberId);
    return this.prisma.$transaction(async (tx) => {
      const after = await tx.projectMember.update({ where: { id: memberId }, data: { role } });
      await this.audit.record(tx, {
        companyId: user.companyId, userId: user.id, entityType: 'Project', entityId: projectId,
        action: 'MEMBER_ROLE_CHANGED', before: { role: before.role }, after: { userId: before.userId, role },
      });
      return after;
    });
  }

  async removeMember(user: SessionUser, projectId: string, memberId: string) {
    await this.projectAccess.load(user, projectId, 'projects.project', 'EDIT');
    const before = await this.prisma.projectMember.findFirst({ where: { id: memberId, projectId } });
    if (!before) throw new NotFoundError('Project member', memberId);
    await this.prisma.$transaction(async (tx) => {
      await tx.projectMember.delete({ where: { id: memberId } });
      await this.audit.record(tx, {
        companyId: user.companyId, userId: user.id, entityType: 'Project', entityId: projectId,
        action: 'MEMBER_REMOVED', after: { userId: before.userId, role: before.role },
      });
    });
  }

  // ---- Contract (one active contract per project) -------------------------------------------------

  async listContracts(user: SessionUser, projectId: string) {
    await this.projectAccess.load(user, projectId, 'projects.contract', 'VIEW');
    return this.prisma.contract.findMany({ where: { projectId, companyId: user.companyId, deletedAt: null }, orderBy: { createdAt: 'desc' }, take: 100 });
  }

  async createContract(user: SessionUser, projectId: string, input: CreateContractInput) {
    const project = await this.projectAccess.load(user, projectId, 'projects.contract', 'CREATE');
    this.projectAccess.assertNotEnded(project);
    return this.prisma.$transaction(async (tx) => {
      const number = await this.numbering.next(tx, user.companyId, 'CONTRACT');
      const created = await tx.contract.create({
        data: { ...input, companyId: user.companyId, projectId, number, currentAmount: input.originalAmount, status: 'DRAFT' },
      });
      await this.audit.record(tx, { companyId: user.companyId, userId: user.id, entityType: 'Contract', entityId: created.id, action: 'CREATE', after: created });
      return created;
    });
  }

  async updateContract(user: SessionUser, id: string, input: UpdateContractInput) {
    const before = await this.loadContract(user, id, 'EDIT');
    if (before.status !== 'DRAFT') throw new BusinessRuleError('Only draft contracts can be edited');
    const data = { ...input, ...(input.originalAmount === undefined ? {} : { currentAmount: input.originalAmount }) };
    return this.updateAudited(user, 'Contract', before, (tx) => tx.contract.update({ where: { id }, data }));
  }

  async activateContract(user: SessionUser, id: string) {
    const contract = await this.loadContract(user, id, 'APPROVE');
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Project" WHERE id = ${contract.projectId} FOR UPDATE`;
      const fresh = await tx.contract.findUniqueOrThrow({ where: { id } });
      if (fresh.status !== 'DRAFT') throw new BusinessRuleError(`A ${fresh.status} contract cannot be activated`);
      const other = await tx.contract.findFirst({ where: { projectId: fresh.projectId, status: 'APPROVED', deletedAt: null, id: { not: id } } });
      if (other) throw new BusinessRuleError(`Project already has an active contract (${other.number}); close it first`);
      const project = await tx.project.findUniqueOrThrow({ where: { id: fresh.projectId } });
      this.projectAccess.assertNotEnded(project);
      const updated = await tx.contract.update({ where: { id }, data: { status: 'APPROVED' } });
      await tx.project.update({ where: { id: fresh.projectId }, data: { contractAmount: fresh.currentAmount } });
      await this.audit.record(tx, {
        companyId: user.companyId, userId: user.id, entityType: 'Contract', entityId: id,
        action: 'APPROVE', before: { status: fresh.status }, after: { status: 'APPROVED', amount: fresh.currentAmount },
      });
      return updated;
    });
  }

  async closeContract(user: SessionUser, id: string, reason: string) {
    const contract = await this.loadContract(user, id, 'CLOSE');
    if (contract.status !== 'APPROVED') throw new BusinessRuleError('Only an active contract can be closed');
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.contract.update({ where: { id }, data: { status: 'CLOSED' } });
      await this.audit.record(tx, {
        companyId: user.companyId, userId: user.id, entityType: 'Contract', entityId: id,
        action: 'CLOSE', before: { status: 'APPROVED' }, after: { status: 'CLOSED' }, reason,
      });
      return updated;
    });
  }

  async cancelContract(user: SessionUser, id: string, reason: string) {
    const contract = await this.loadContract(user, id, 'CANCEL');
    if (contract.status !== 'DRAFT') throw new BusinessRuleError('Only a draft contract can be cancelled; close an active one instead');
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.contract.update({ where: { id }, data: { status: 'CANCELLED' } });
      await this.audit.record(tx, {
        companyId: user.companyId, userId: user.id, entityType: 'Contract', entityId: id,
        action: 'CANCEL', before: { status: 'DRAFT' }, after: { status: 'CANCELLED' }, reason,
      });
      return updated;
    });
  }

  // ---- Dashboard ---------------------------------------------------------------------------------

  /** Real aggregates only. Financial figures are null when the caller cannot view project budgets. */
  async dashboard(user: SessionUser, id: string) {
    const project = await this.projectAccess.load(user, id, 'projects.project', 'VIEW');
    const financial = this.access.can(user, 'projects.budget', 'VIEW', { projectId: id });
    const procurement = this.access.can(user, 'procurement.order', 'VIEW', { projectId: id });

    const [contract, budget, actual, openLines, counts] = await Promise.all([
      this.prisma.contract.findFirst({ where: { projectId: id, status: 'APPROVED', deletedAt: null } }),
      this.prisma.budget.findFirst({ where: { projectId: id, isCurrent: true }, select: { id: true, version: true, totalAmount: true } }),
      financial ? this.costLedger.actualByProject(this.prisma, user.companyId, id) : Promise.resolve(null),
      procurement
        ? this.prisma.purchaseOrderLine.findMany({
            where: { order: { projectId: id, companyId: user.companyId, deletedAt: null, status: { in: [...OPEN_PO] } } },
            select: { qty: true, cancelledQty: true, receivedQty: true, lineTotal: true, taxAmount: true },
          })
        : Promise.resolve(null),
      Promise.all([
        this.prisma.purchaseRequisition.count({ where: { projectId: id, deletedAt: null, status: { in: [...OPEN_PR] } } }),
        this.prisma.purchaseOrder.count({ where: { projectId: id, deletedAt: null, status: { in: [...LIVE_PO] } } }),
        this.prisma.wbsNode.count({ where: { projectId: id, deletedAt: null } }),
        this.prisma.boqItem.count({ where: { projectId: id, deletedAt: null } }),
        this.prisma.projectMember.count({ where: { projectId: id } }),
      ]),
    ]);

    const committed = openLines
      ? openLines.reduce((sum, l) => {
          if (l.qty.isZero()) return sum;
          const remaining = nonNegative(l.qty.minus(l.cancelledQty).minus(l.receivedQty));
          return sum.plus(round2(remaining.div(l.qty).mul(l.lineTotal.plus(l.taxAmount))));
        }, ZERO)
      : null;

    return {
      projectId: id,
      status: project.status,
      progressPct: project.progressPct.toString(),
      financial: financial
        ? {
            contractValue: dec(contract?.currentAmount ?? project.contractAmount).toFixed(2),
            contractValueSource: contract ? ('CONTRACT' as const) : ('PROJECT' as const),
            budget: budget ? { budgetId: budget.id, version: budget.version, totalAmount: budget.totalAmount.toFixed(2) } : null,
            committed: committed ? committed.toFixed(2) : null,
            actual: actual ? actual.toFixed(2) : '0.00',
          }
        : null,
      counts: {
        openRequisitions: counts[0],
        openPurchaseOrders: counts[1],
        wbsNodes: counts[2],
        boqItems: counts[3],
        teamMembers: counts[4],
      },
    };
  }

  async activityFor(user: SessionUser, id: string) {
    await this.projectAccess.load(user, id, 'projects.project', 'VIEW');
    return this.activity.forDocument({ companyId: user.companyId, entityType: 'Project', entityId: id });
  }

  // ---- helpers -----------------------------------------------------------------------------------

  private async loadContract(user: SessionUser, id: string, action: 'EDIT' | 'APPROVE' | 'CLOSE' | 'CANCEL') {
    const contract = await this.prisma.contract.findFirst({ where: { id, companyId: user.companyId, deletedAt: null } });
    if (!contract) throw new NotFoundError('Contract', id);
    this.access.assertCan(user, 'projects.contract', action, { projectId: contract.projectId });
    return contract;
  }

  private async assertNoOpenProcurement(tx: Db, projectId: string, target: string): Promise<void> {
    const [orders, requisitions] = await Promise.all([
      tx.purchaseOrder.count({ where: { projectId, deletedAt: null, status: { in: [...LIVE_PO] } } }),
      tx.purchaseRequisition.count({ where: { projectId, deletedAt: null, status: { in: [...OPEN_PR, 'DRAFT'] } } }),
    ]);
    if (orders > 0 || requisitions > 0) {
      throw new BusinessRuleError(
        `Cannot move the project to ${target}: ${orders} open purchase order(s) and ${requisitions} open requisition(s) must be closed or cancelled first`,
      );
    }
  }

  private async assertRefs(
    user: SessionUser,
    input: { customerId?: string; branchId?: string | null; managerId?: string | null; costCenterId?: string | null },
  ): Promise<void> {
    const companyId = user.companyId;
    const missing: Array<{ path: string; message: string }> = [];
    const checks: Array<Promise<void>> = [];
    const check = (path: string, found: Promise<unknown>, label: string) =>
      checks.push(found.then((r) => { if (!r) missing.push({ path, message: `${label} not found in this company` }); }));
    if (input.customerId) check('customerId', this.prisma.customer.findFirst({ where: { id: input.customerId, companyId, deletedAt: null }, select: { id: true } }), 'Customer');
    if (input.branchId) check('branchId', this.prisma.branch.findFirst({ where: { id: input.branchId, companyId, deletedAt: null }, select: { id: true } }), 'Branch');
    if (input.managerId) check('managerId', this.prisma.user.findFirst({ where: { id: input.managerId, companyId, deletedAt: null, active: true }, select: { id: true } }), 'Manager');
    if (input.costCenterId) check('costCenterId', this.prisma.costCenter.findFirst({ where: { id: input.costCenterId, companyId, deletedAt: null }, select: { id: true } }), 'Cost center');
    await Promise.all(checks);
    if (missing.length > 0) throw new BusinessRuleError('Referenced records were not found', missing);
  }
}
