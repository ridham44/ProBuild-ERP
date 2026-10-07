import { PrismaClient } from '@prisma/client';
import {
  DEFAULT_CHART_OF_ACCOUNTS,
  DEFAULT_ROLES,
  DEFAULT_TAX_CODES,
  expandRolePermissions,
} from '@probuild/shared';
import * as argon2 from 'argon2';
import { existsSync } from 'node:fs';

if (existsSync('.env')) process.loadEnvFile('.env');
const prisma = new PrismaClient();

async function main(): Promise<void> {
  const company = await prisma.company.upsert({
    where: { code: 'DEMO' },
    update: {},
    create: { code: 'DEMO', legalName: 'Demo Builders Corporation', tradeName: 'Demo Builders', tin: '000-000-000-000', vatStatus: 'VAT' },
  });

  for (const a of DEFAULT_CHART_OF_ACCOUNTS) {
    await prisma.account.upsert({
      where: { companyId_code: { companyId: company.id, code: a.code } },
      update: {},
      create: { companyId: company.id, code: a.code, name: a.name, type: a.type },
    });
  }

  for (const t of DEFAULT_TAX_CODES) {
    const existing = await prisma.taxCode.findUnique({ where: { companyId_code: { companyId: company.id, code: t.code } } });
    if (existing) continue;
    await prisma.taxCode.create({
      data: {
        companyId: company.id,
        code: t.code,
        name: t.name,
        kind: t.kind,
        rates: { create: { ratePct: t.ratePct, effectiveFrom: new Date(t.effectiveFrom) } },
      },
    });
  }

  const roleIds = new Map<string, string>();
  for (const [name, grants] of Object.entries(DEFAULT_ROLES)) {
    const role = await prisma.role.upsert({
      where: { companyId_name: { companyId: company.id, name } },
      update: {},
      create: { companyId: company.id, name, isSystem: true },
    });
    roleIds.set(name, role.id);
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    await prisma.rolePermission.createMany({
      data: expandRolePermissions(grants).map((p) => ({ roleId: role.id, module: p.module, action: p.action })),
    });
  }

  const password = process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe!12345';
  const admin = await prisma.user.upsert({
    where: { email: 'admin@probuild.local' },
    update: {},
    create: {
      companyId: company.id,
      email: 'admin@probuild.local',
      name: 'System Admin',
      passwordHash: await argon2.hash(password),
      isSuperAdmin: true,
    },
  });
  const adminRoleId = roleIds.get('Company Admin');
  if (adminRoleId && !(await prisma.userRoleAssignment.findFirst({ where: { userId: admin.id, roleId: adminRoleId } }))) {
    await prisma.userRoleAssignment.create({ data: { userId: admin.id, roleId: adminRoleId } });
  }

  await prisma.approvalWorkflow.upsert({
    where: { companyId_documentType: { companyId: company.id, documentType: 'PURCHASE_REQUISITION' } },
    update: {},
    create: {
      companyId: company.id,
      documentType: 'PURCHASE_REQUISITION',
      name: 'Purchase Requisition',
      rules: {
        create: [
          { minAmount: 0, maxAmount: 50000, steps: { create: [{ stepOrder: 1, roleName: 'Project Manager' }] } },
          { minAmount: 50000.01, maxAmount: 250000, steps: { create: [{ stepOrder: 1, roleName: 'Project Manager' }, { stepOrder: 2, roleName: 'Procurement' }] } },
          { minAmount: 250000.01, steps: { create: [{ stepOrder: 1, roleName: 'Project Manager' }, { stepOrder: 2, roleName: 'Finance' }, { stepOrder: 3, roleName: 'Company Admin' }] } },
        ],
      },
    },
  });

  console.log('Seeded. Login: admin@probuild.local /', password === 'ChangeMe!12345' ? 'ChangeMe!12345 (change it)' : '[SEED_ADMIN_PASSWORD]');
}

main()
  .catch((e: unknown) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
