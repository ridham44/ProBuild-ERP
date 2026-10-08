import { PrismaClient } from '@prisma/client';
import {
  passwordSchema,
  DEFAULT_CHART_OF_ACCOUNTS,
  DEFAULT_ROLES,
  DEFAULT_TAX_CODES,
  expandRolePermissions,
} from '@probuild/shared';
import * as argon2 from 'argon2';
import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';

if (existsSync('../../.env')) process.loadEnvFile('../../.env');
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

  // No published default credentials: production must supply a password, development gets a random one.
  const supplied = process.env.SEED_ADMIN_PASSWORD;
  if (process.env.NODE_ENV === 'production' && !supplied) {
    throw new Error('SEED_ADMIN_PASSWORD is required when NODE_ENV=production');
  }
  if (supplied) {
    const check = passwordSchema.safeParse(supplied);
    if (!check.success) throw new Error(`SEED_ADMIN_PASSWORD rejected: ${check.error.issues[0]?.message ?? 'invalid'}`);
  }
  const password = supplied ?? randomBytes(12).toString('base64url') + '9';
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@probuild.local';
  const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });
  const admin =
    existingAdmin ??
    (await prisma.user.create({
      data: {
        companyId: company.id,
        email: adminEmail,
        name: 'System Admin',
        passwordHash: await argon2.hash(password),
        isSuperAdmin: true,
        mustChangePassword: true,
      },
    }));
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

  await prisma.approvalWorkflow.upsert({
    where: { companyId_documentType: { companyId: company.id, documentType: 'PURCHASE_ORDER' } },
    update: {},
    create: {
      companyId: company.id,
      documentType: 'PURCHASE_ORDER',
      name: 'Purchase Order',
      rules: {
        create: [
          { minAmount: 0, maxAmount: 100000, steps: { create: [{ stepOrder: 1, roleName: 'Procurement' }] } },
          { minAmount: 100000.01, maxAmount: 500000, steps: { create: [{ stepOrder: 1, roleName: 'Procurement' }, { stepOrder: 2, roleName: 'Finance' }] } },
          { minAmount: 500000.01, steps: { create: [{ stepOrder: 1, roleName: 'Procurement' }, { stepOrder: 2, roleName: 'Finance' }, { stepOrder: 3, roleName: 'Company Admin' }] } },
        ],
      },
    },
  });

  // Stage F-J workflows: material requests are approved by the project manager; stock adjustments and counts by a
  // warehouse manager (plus finance for large values). Warehouse transfers have no default workflow (optional).
  const stockWorkflows: Array<{ documentType: string; name: string; rules: Array<{ min: number; max?: number; roles: string[] }> }> = [
    { documentType: 'MATERIAL_REQUEST', name: 'Material Request', rules: [{ min: 0, max: 100000, roles: ['Project Manager'] }, { min: 100000.01, roles: ['Project Manager', 'Procurement'] }] },
    { documentType: 'STOCK_ADJUSTMENT', name: 'Stock Adjustment', rules: [{ min: 0, max: 50000, roles: ['Warehouse Manager'] }, { min: 50000.01, roles: ['Warehouse Manager', 'Finance'] }] },
    { documentType: 'STOCK_COUNT', name: 'Stock Count', rules: [{ min: 0, max: 50000, roles: ['Warehouse Manager'] }, { min: 50000.01, roles: ['Warehouse Manager', 'Finance'] }] },
  ];
  for (const w of stockWorkflows) {
    await prisma.approvalWorkflow.upsert({
      where: { companyId_documentType: { companyId: company.id, documentType: w.documentType } },
      update: {},
      create: {
        companyId: company.id,
        documentType: w.documentType,
        name: w.name,
        rules: {
          create: w.rules.map((r) => ({
            minAmount: r.min,
            maxAmount: r.max ?? null,
            steps: { create: r.roles.map((roleName, i) => ({ stepOrder: i + 1, roleName })) },
          })),
        },
      },
    });
  }

  if (existingAdmin) console.log(`Seeded. Admin ${adminEmail} already existed; password unchanged.`);
  else if (supplied) console.log(`Seeded. Admin ${adminEmail} created with the password from SEED_ADMIN_PASSWORD (change required at first login).`);
  else console.log(`Seeded. Admin ${adminEmail} generated one-time password: ${password}  (change required at first login; shown once)`);
}

main()
  .catch((e: unknown) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
