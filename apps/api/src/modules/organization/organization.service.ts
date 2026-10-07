import { Injectable } from '@nestjs/common';
import type {
  PaginationQuery,
  WarehouseStockQuery,
  SessionUser,
  UpdateCompanyInput,
} from '@probuild/shared';
import type { z } from 'zod';
import type {
  createBankAccountSchema,
  createBranchSchema,
  createCostCenterSchema,
  createDepartmentSchema,
  createLocationSchema,
  createWarehouseSchema,
  updateBankAccountSchema,
  updateBranchSchema,
  updateCostCenterSchema,
  updateDepartmentSchema,
  updateWarehouseSchema,
} from '@probuild/shared';
import { BusinessRuleError, NotFoundError } from '../../common/errors/domain-errors';
import { paginate } from '../../common/pagination';
import { ActivityService } from '../../engines/activity/activity.service';
import { AuditService } from '../../engines/audit/audit.service';
import { PrismaService } from '../../prisma/prisma.service';

type Input<T extends z.ZodTypeAny> = z.infer<T>;

/**
 * Reference implementation for a feature service: every query is scoped by the caller's companyId,
 * deletes are soft, and every write records before/after in the audit trail.
 */
@Injectable()
export class OrganizationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly activity: ActivityService,
  ) {}

  // ---- Company ----------------------------------------------------------------------------

  getCompany(user: SessionUser) {
    return this.prisma.company.findFirstOrThrow({ where: { id: user.companyId, deletedAt: null } });
  }

  async updateCompany(user: SessionUser, input: UpdateCompanyInput) {
    const before = await this.getCompany(user);
    return this.prisma.$transaction(async (tx) => {
      const after = await tx.company.update({ where: { id: user.companyId }, data: input });
      await this.audit.record(tx, { companyId: user.companyId, userId: user.id, entityType: 'Company', entityId: after.id, action: 'UPDATE', before, after });
      return after;
    });
  }

  // ---- Branches ---------------------------------------------------------------------------

  listBranches(user: SessionUser, query: PaginationQuery) {
    return paginate(
      (args) =>
        this.prisma.branch.findMany({
          where: { companyId: user.companyId, deletedAt: null, ...(query.search ? { name: { contains: query.search, mode: 'insensitive' } } : {}) },
          orderBy: [{ code: 'asc' }, { id: 'asc' }],
          ...args,
        }),
      query,
    );
  }

  createBranch(user: SessionUser, input: Input<typeof createBranchSchema>) {
    return this.create(user, 'Branch', (tx) => tx.branch.create({ data: { ...input, companyId: user.companyId } }));
  }

  async updateBranch(user: SessionUser, id: string, input: Input<typeof updateBranchSchema>) {
    const before = await this.prisma.branch.findFirst({ where: { id, companyId: user.companyId, deletedAt: null } });
    if (!before) throw new NotFoundError('Branch', id);
    return this.update(user, 'Branch', before, (tx) => tx.branch.update({ where: { id }, data: input }));
  }

  async deleteBranch(user: SessionUser, id: string) {
    const before = await this.prisma.branch.findFirst({ where: { id, companyId: user.companyId, deletedAt: null } });
    if (!before) throw new NotFoundError('Branch', id);
    await this.softDelete(user, 'Branch', before, (tx) => tx.branch.update({ where: { id }, data: { deletedAt: new Date() } }));
  }

  // ---- Departments ------------------------------------------------------------------------

  listDepartments(user: SessionUser, query: PaginationQuery) {
    return paginate(
      (args) =>
        this.prisma.department.findMany({
          where: { companyId: user.companyId, deletedAt: null, ...(query.search ? { name: { contains: query.search, mode: 'insensitive' } } : {}) },
          orderBy: [{ code: 'asc' }, { id: 'asc' }],
          ...args,
        }),
      query,
    );
  }

  createDepartment(user: SessionUser, input: Input<typeof createDepartmentSchema>) {
    return this.create(user, 'Department', (tx) => tx.department.create({ data: { ...input, companyId: user.companyId } }));
  }

  async updateDepartment(user: SessionUser, id: string, input: Input<typeof updateDepartmentSchema>) {
    const before = await this.prisma.department.findFirst({ where: { id, companyId: user.companyId, deletedAt: null } });
    if (!before) throw new NotFoundError('Department', id);
    return this.update(user, 'Department', before, (tx) => tx.department.update({ where: { id }, data: input }));
  }

  async deleteDepartment(user: SessionUser, id: string) {
    const before = await this.prisma.department.findFirst({ where: { id, companyId: user.companyId, deletedAt: null } });
    if (!before) throw new NotFoundError('Department', id);
    await this.softDelete(user, 'Department', before, (tx) => tx.department.update({ where: { id }, data: { deletedAt: new Date() } }));
  }

  // ---- Cost centers -----------------------------------------------------------------------

  listCostCenters(user: SessionUser, query: PaginationQuery) {
    return paginate(
      (args) =>
        this.prisma.costCenter.findMany({
          where: { companyId: user.companyId, deletedAt: null, ...(query.search ? { name: { contains: query.search, mode: 'insensitive' } } : {}) },
          orderBy: [{ code: 'asc' }, { id: 'asc' }],
          ...args,
        }),
      query,
    );
  }

  createCostCenter(user: SessionUser, input: Input<typeof createCostCenterSchema>) {
    return this.create(user, 'CostCenter', (tx) => tx.costCenter.create({ data: { ...input, companyId: user.companyId } }));
  }

  async updateCostCenter(user: SessionUser, id: string, input: Input<typeof updateCostCenterSchema>) {
    const before = await this.prisma.costCenter.findFirst({ where: { id, companyId: user.companyId, deletedAt: null } });
    if (!before) throw new NotFoundError('CostCenter', id);
    return this.update(user, 'CostCenter', before, (tx) => tx.costCenter.update({ where: { id }, data: input }));
  }

  async deleteCostCenter(user: SessionUser, id: string) {
    const before = await this.prisma.costCenter.findFirst({ where: { id, companyId: user.companyId, deletedAt: null } });
    if (!before) throw new NotFoundError('CostCenter', id);
    await this.softDelete(user, 'CostCenter', before, (tx) => tx.costCenter.update({ where: { id }, data: { deletedAt: new Date() } }));
  }

  // ---- Warehouses and bins ------------------------------------------------------------------

  listWarehouses(user: SessionUser, query: PaginationQuery, allowedIds: 'ALL' | string[]) {
    return paginate(
      (args) =>
        this.prisma.warehouse.findMany({
          where: {
            companyId: user.companyId,
            deletedAt: null,
            ...(allowedIds === 'ALL' ? {} : { id: { in: allowedIds } }),
            ...(query.search ? { name: { contains: query.search, mode: 'insensitive' } } : {}),
          },
          orderBy: [{ code: 'asc' }, { id: 'asc' }],
          include: { branch: { select: { id: true, name: true } }, project: { select: { id: true, name: true } } },
          ...args,
        }),
      query,
    );
  }

  async createWarehouse(user: SessionUser, input: Input<typeof createWarehouseSchema>) {
    await this.assertWarehouseRefs(user, input);
    return this.create(user, 'Warehouse', (tx) => tx.warehouse.create({ data: { ...input, companyId: user.companyId } }));
  }

  async updateWarehouse(user: SessionUser, id: string, input: Input<typeof updateWarehouseSchema>) {
    const before = await this.prisma.warehouse.findFirst({ where: { id, companyId: user.companyId, deletedAt: null } });
    if (!before) throw new NotFoundError('Warehouse', id);
    if (input.parentWarehouseId === id) throw new BusinessRuleError('A warehouse cannot be its own parent');
    await this.assertWarehouseRefs(user, input);
    return this.update(user, 'Warehouse', before, (tx) => tx.warehouse.update({ where: { id }, data: input }));
  }

  /** Builds the zone/rack/shelf/bin path (e.g. WH-MNL/A/R03/S02/B15) from the parent chain. */
  async createLocation(user: SessionUser, input: Input<typeof createLocationSchema>) {
    const warehouse = await this.prisma.warehouse.findFirst({ where: { id: input.warehouseId, companyId: user.companyId, deletedAt: null } });
    if (!warehouse) throw new NotFoundError('Warehouse', input.warehouseId);

    let basePath = warehouse.code;
    if (input.parentId) {
      const parent = await this.prisma.warehouseLocation.findFirst({
        where: { id: input.parentId, warehouseId: input.warehouseId, deletedAt: null },
      });
      if (!parent) throw new NotFoundError('Parent location', input.parentId);
      basePath = parent.fullPath;
    }
    const fullPath = `${basePath}/${input.code}`;
    return this.create(user, 'WarehouseLocation', (tx) =>
      tx.warehouseLocation.create({
        data: {
          companyId: user.companyId,
          warehouseId: input.warehouseId,
          parentId: input.parentId ?? null,
          level: input.level,
          code: input.code,
          fullPath,
          qrCode: fullPath,
        },
      }),
    );
  }

  listLocations(user: SessionUser, warehouseId: string) {
    return this.prisma.warehouseLocation.findMany({
      where: { companyId: user.companyId, warehouseId, deletedAt: null },
      orderBy: { fullPath: 'asc' },
      take: 500,
    });
  }

  // ---- Warehouse detail ---------------------------------------------------------------------

  async getWarehouse(user: SessionUser, id: string) {
    const warehouse = await this.prisma.warehouse.findFirst({
      where: { id, companyId: user.companyId, deletedAt: null },
      include: {
        branch: { select: { id: true, code: true, name: true } },
        project: { select: { id: true, code: true, name: true } },
        parentWarehouse: { select: { id: true, code: true, name: true } },
      },
    });
    if (!warehouse) throw new NotFoundError('Warehouse', id);
    return warehouse;
  }

  /** Location and stock totals derived from live StockBalance rows; nothing here is stored or estimated. */
  async warehouseSummary(user: SessionUser, id: string) {
    await this.getWarehouse(user, id);
    const [levels, balances, distinct] = await Promise.all([
      this.prisma.warehouseLocation.groupBy({
        by: ['level'],
        where: { companyId: user.companyId, warehouseId: id, deletedAt: null, active: true },
        _count: { _all: true },
      }),
      this.prisma.stockBalance.groupBy({
        by: ['stockStatus'],
        where: { companyId: user.companyId, warehouseId: id },
        _sum: { qtyOnHand: true, value: true },
      }),
      this.prisma.stockBalance.findMany({
        where: { companyId: user.companyId, warehouseId: id, qtyOnHand: { not: 0 } },
        distinct: ['itemId'],
        select: { itemId: true },
      }),
    ]);
    const money = (v: { toFixed: (dp: number) => string } | null | undefined, dp: number) => (v ? v.toFixed(dp) : (0).toFixed(dp));
    return {
      warehouseId: id,
      locations: {
        total: levels.reduce((n, l) => n + l._count._all, 0),
        byLevel: levels.map((l) => ({ level: l.level, count: l._count._all })),
      },
      stock: {
        distinctItems: distinct.length,
        byStatus: balances.map((b) => ({ stockStatus: b.stockStatus, qtyOnHand: money(b._sum.qtyOnHand, 4), value: money(b._sum.value, 2) })),
      },
    };
  }

  async warehouseStock(user: SessionUser, id: string, query: WarehouseStockQuery) {
    await this.getWarehouse(user, id);
    return paginate(
      (args) =>
        this.prisma.stockBalance.findMany({
          where: {
            companyId: user.companyId,
            warehouseId: id,
            ...(query.stockStatus ? { stockStatus: query.stockStatus } : {}),
            ...(query.categoryId ? { item: { categoryId: query.categoryId } } : {}),
            ...(query.search ? { item: { OR: [{ sku: { contains: query.search, mode: 'insensitive' } }, { name: { contains: query.search, mode: 'insensitive' } }] } } : {}),
          },
          orderBy: [{ item: { sku: 'asc' } }, { id: 'asc' }],
          include: { item: { select: { id: true, sku: true, name: true, baseUnit: true } } },
          ...args,
        }),
      query,
    );
  }

  async warehouseActivity(user: SessionUser, id: string) {
    await this.getWarehouse(user, id);
    return this.activity.forDocument({ companyId: user.companyId, entityType: 'Warehouse', entityId: id });
  }

  // ---- Bank accounts ----------------------------------------------------------------------

  listBankAccounts(user: SessionUser) {
    return this.prisma.bankAccount.findMany({
      where: { companyId: user.companyId, deletedAt: null },
      orderBy: { bankName: 'asc' },
      take: 100,
    });
  }

  createBankAccount(user: SessionUser, input: Input<typeof createBankAccountSchema>) {
    return this.create(user, 'BankAccount', (tx) => tx.bankAccount.create({ data: { ...input, companyId: user.companyId } }));
  }

  async updateBankAccount(user: SessionUser, id: string, input: Input<typeof updateBankAccountSchema>) {
    const before = await this.prisma.bankAccount.findFirst({ where: { id, companyId: user.companyId, deletedAt: null } });
    if (!before) throw new NotFoundError('BankAccount', id);
    return this.update(user, 'BankAccount', before, (tx) => tx.bankAccount.update({ where: { id }, data: input }));
  }

  // ---- helpers ----------------------------------------------------------------------------

  private async assertWarehouseRefs(
    user: SessionUser,
    input: { branchId?: string | null; projectId?: string | null; parentWarehouseId?: string | null },
  ): Promise<void> {
    const checks: Array<Promise<unknown>> = [];
    if (input.branchId) {
      checks.push(this.prisma.branch.findFirst({ where: { id: input.branchId, companyId: user.companyId, deletedAt: null } }).then((r) => { if (!r) throw new BusinessRuleError('Branch not found'); }));
    }
    if (input.projectId) {
      checks.push(this.prisma.project.findFirst({ where: { id: input.projectId, companyId: user.companyId, deletedAt: null } }).then((r) => { if (!r) throw new BusinessRuleError('Project not found'); }));
    }
    if (input.parentWarehouseId) {
      checks.push(this.prisma.warehouse.findFirst({ where: { id: input.parentWarehouseId, companyId: user.companyId, deletedAt: null } }).then((r) => { if (!r) throw new BusinessRuleError('Parent warehouse not found'); }));
    }
    await Promise.all(checks);
  }

  private create<T extends { id: string }>(
    user: SessionUser,
    entityType: string,
    run: (tx: Parameters<Parameters<PrismaService['$transaction']>[0]>[0]) => Promise<T>,
  ): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      const created = await run(tx);
      await this.audit.record(tx, { companyId: user.companyId, userId: user.id, entityType, entityId: created.id, action: 'CREATE', after: created });
      return created;
    });
  }

  private update<T extends { id: string }>(
    user: SessionUser,
    entityType: string,
    before: unknown,
    run: (tx: Parameters<Parameters<PrismaService['$transaction']>[0]>[0]) => Promise<T>,
  ): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      const after = await run(tx);
      await this.audit.record(tx, { companyId: user.companyId, userId: user.id, entityType, entityId: after.id, action: 'UPDATE', before, after });
      return after;
    });
  }

  private softDelete<T extends { id: string }>(
    user: SessionUser,
    entityType: string,
    before: T,
    run: (tx: Parameters<Parameters<PrismaService['$transaction']>[0]>[0]) => Promise<unknown>,
  ): Promise<void> {
    return this.prisma.$transaction(async (tx) => {
      await run(tx);
      await this.audit.record(tx, { companyId: user.companyId, userId: user.id, entityType, entityId: before.id, action: 'DELETE', before });
    });
  }
}
