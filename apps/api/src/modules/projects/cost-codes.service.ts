import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { COST_CODE_SORT_FIELDS } from '@probuild/shared';
import type { CostCodeListQuery, CreateCostCodeInput, SessionUser, UpdateCostCodeInput } from '@probuild/shared';
import { AuditedService } from '../../common/audited-service';
import { BusinessRuleError, NotFoundError } from '../../common/errors/domain-errors';
import { buildOrderBy, containsAny } from '../../common/list';
import { paginate } from '../../common/pagination';
import { ActivityService } from '../../engines/activity/activity.service';
import { AuditService } from '../../engines/audit/audit.service';
import { PrismaService } from '../../prisma/prisma.service';

/** Cost codes are a per-company hierarchy (each contractor defines its own coding system). */
@Injectable()
export class CostCodesService extends AuditedService {
  constructor(
    prisma: PrismaService,
    audit: AuditService,
    private readonly activity: ActivityService,
  ) {
    super(prisma, audit);
  }

  list(user: SessionUser, query: CostCodeListQuery) {
    const where: Prisma.CostCodeWhereInput = {
      companyId: user.companyId,
      deletedAt: null,
      ...containsAny(query.search, ['code', 'name']),
      ...(query.category ? { category: query.category } : {}),
      ...(query.parentId ? { parentId: query.parentId } : {}),
      ...(query.active === undefined ? {} : { active: query.active }),
    };
    return paginate(
      (args) => this.prisma.costCode.findMany({ where, orderBy: buildOrderBy(query.sort, COST_CODE_SORT_FIELDS, [{ code: 'asc' }]), ...args }),
      query,
    );
  }

  async get(user: SessionUser, id: string) {
    return this.find(user, id);
  }

  async create(user: SessionUser, input: CreateCostCodeInput) {
    if (input.parentId) await this.find(user, input.parentId, true);
    return this.createAudited(user, 'CostCode', (tx) => tx.costCode.create({ data: { ...input, companyId: user.companyId } }));
  }

  async update(user: SessionUser, id: string, input: UpdateCostCodeInput) {
    const before = await this.find(user, id);
    if (input.parentId) {
      if (input.parentId === id) throw new BusinessRuleError('A cost code cannot be its own parent');
      await this.find(user, input.parentId, true);
      await this.assertNoCycle(user, id, input.parentId);
    }
    return this.updateAudited(user, 'CostCode', before, (tx) => tx.costCode.update({ where: { id }, data: input }));
  }

  async remove(user: SessionUser, id: string) {
    const before = await this.find(user, id);
    const [children, boq, prLines, poLines, cost] = await Promise.all([
      this.prisma.costCode.count({ where: { parentId: id, deletedAt: null } }),
      this.prisma.boqItem.count({ where: { costCodeId: id, deletedAt: null } }),
      this.prisma.purchaseRequisitionLine.count({ where: { costCodeId: id } }),
      this.prisma.purchaseOrderLine.count({ where: { costCodeId: id } }),
      this.prisma.projectCostLedger.count({ where: { costCodeId: id } }),
    ]);
    if (children + boq + prLines + poLines + cost > 0) {
      throw new BusinessRuleError('This cost code has children or is in use and cannot be deleted. Deactivate it instead.');
    }
    await this.softDeleteAudited(user, 'CostCode', before, (tx) =>
      tx.costCode.update({ where: { id }, data: { deletedAt: new Date(), active: false, code: `${before.code}~del~${id.slice(0, 8)}` } }),
    );
  }

  async activityFor(user: SessionUser, id: string) {
    await this.find(user, id);
    return this.activity.forDocument({ companyId: user.companyId, entityType: 'CostCode', entityId: id });
  }

  private async find(user: SessionUser, id: string, asReference = false) {
    const found = await this.prisma.costCode.findFirst({ where: { id, companyId: user.companyId, deletedAt: null } });
    if (!found) {
      if (asReference) throw new BusinessRuleError('Parent cost code not found');
      throw new NotFoundError('Cost code', id);
    }
    return found;
  }

  private async assertNoCycle(user: SessionUser, id: string, newParentId: string): Promise<void> {
    let cursor: string | null = newParentId;
    for (let depth = 0; cursor && depth < 50; depth++) {
      if (cursor === id) throw new BusinessRuleError('This move would make the cost code its own ancestor');
      const parent: { parentId: string | null } | null = await this.prisma.costCode.findFirst({
        where: { id: cursor, companyId: user.companyId },
        select: { parentId: true },
      });
      cursor = parent?.parentId ?? null;
    }
  }
}
