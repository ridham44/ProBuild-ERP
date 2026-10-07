import { PrismaClient } from '@prisma/client';
import { DEFAULT_CHART_OF_ACCOUNTS, DEFAULT_ROLES, expandRolePermissions } from '@probuild/shared';
import * as argon2 from 'argon2';
import { randomUUID } from 'node:crypto';

export const TEST_PASSWORD = 'Correct-Horse-42';

// Hashing is deliberately slow; every fixture user shares one hash of the same password.
let cachedHash: Promise<string> | undefined;
const testPasswordHash = (): Promise<string> => (cachedHash ??= argon2.hash(TEST_PASSWORD));

export type TestCompany = { id: string; code: string; roleIds: Map<string, string> };

/** Creates an isolated company with the chart of accounts and all default roles. */
export async function createCompany(prisma: PrismaClient, label = 'Co'): Promise<TestCompany> {
  const code = `${label}-${randomUUID().slice(0, 8)}`;
  const company = await prisma.company.create({ data: { code, legalName: `${label} Builders Corp.` } });
  await prisma.account.createMany({
    data: DEFAULT_CHART_OF_ACCOUNTS.map((a) => ({ companyId: company.id, code: a.code, name: a.name, type: a.type })),
  });
  const roleIds = new Map<string, string>();
  for (const [name, grants] of Object.entries(DEFAULT_ROLES)) {
    const role = await prisma.role.create({ data: { companyId: company.id, name, isSystem: true } });
    await prisma.rolePermission.createMany({
      data: expandRolePermissions(grants).map((p) => ({ roleId: role.id, module: p.module, action: p.action })),
    });
    roleIds.set(name, role.id);
  }
  return { id: company.id, code, roleIds };
}

export type UserFixtureOptions = {
  roles?: string[];
  superAdmin?: boolean;
  projectId?: string;
  warehouseId?: string;
  mustChangePassword?: boolean;
};

export async function createUser(prisma: PrismaClient, company: TestCompany, options: UserFixtureOptions = {}) {
  const email = `user-${randomUUID().slice(0, 8)}@test.local`;
  const user = await prisma.user.create({
    data: {
      companyId: company.id,
      email,
      name: 'Test User',
      passwordHash: await testPasswordHash(),
      isSuperAdmin: options.superAdmin ?? false,
      mustChangePassword: options.mustChangePassword ?? false,
    },
  });
  for (const roleName of options.roles ?? []) {
    const roleId = company.roleIds.get(roleName);
    if (!roleId) throw new Error(`Unknown role ${roleName}`);
    await prisma.userRoleAssignment.create({
      data: { userId: user.id, roleId, projectId: options.projectId ?? null, warehouseId: options.warehouseId ?? null },
    });
  }
  return { id: user.id, email };
}

export async function createCustomerAndProject(prisma: PrismaClient, company: TestCompany, code = 'P1') {
  const customer = await prisma.customer.create({ data: { companyId: company.id, code: `C-${code}`, name: 'Megaworld Land Inc.' } });
  const project = await prisma.project.create({
    data: { companyId: company.id, customerId: customer.id, code, name: `Tower ${code}`, status: 'ACTIVE' },
  });
  return { customer, project };
}

export async function createWarehouse(prisma: PrismaClient, company: TestCompany, code = 'WH1') {
  return prisma.warehouse.create({ data: { companyId: company.id, code, name: `Warehouse ${code}` } });
}

export async function createItem(prisma: PrismaClient, company: TestCompany, sku = 'CEM-40', baseUnit = 'bag') {
  return prisma.item.create({ data: { companyId: company.id, sku, name: 'Portland Cement 40kg', baseUnit } });
}
