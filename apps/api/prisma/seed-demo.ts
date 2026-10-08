import { PrismaClient } from '@prisma/client';
import { existsSync } from 'node:fs';

if (existsSync('../../.env')) process.loadEnvFile('../../.env');
const prisma = new PrismaClient();

const MANILA_OFFSET_HOURS = 8;

/** Month boundaries in Manila time, stored as UTC instants (same convention as the accounting module). */
function manilaMonthRange(year: number, month: number): { start: Date; end: Date } {
  const start = new Date(Date.UTC(year, month - 1, 1) - MANILA_OFFSET_HOURS * 3_600_000);
  const nextStart = new Date(Date.UTC(year, month, 1) - MANILA_OFFSET_HOURS * 3_600_000);
  return { start, end: new Date(nextStart.getTime() - 1) };
}

const UNITS = [
  { code: 'PCS', name: 'Pieces' },
  { code: 'BAG', name: 'Bag' },
  { code: 'KG', name: 'Kilogram' },
  { code: 'M', name: 'Meter' },
  { code: 'M3', name: 'Cubic meter' },
  { code: 'LTR', name: 'Liter' },
];

const CATEGORIES = ['Cement & Aggregates', 'Steel & Rebar', 'Electrical', 'Plumbing', 'Safety & PPE'];

const CUSTOMERS = [
  { code: 'CUS-001', name: 'Metro Heights Development Corp.', email: 'projects@metroheights.example', phone: '+63 2 8555 0101', billingAddress: 'Ayala Ave, Makati City', paymentTermsDays: 30 },
  { code: 'CUS-002', name: 'Department of Public Works (Region IV-A)', email: 'bac@dpwh-demo.example', phone: '+63 49 555 0102', billingAddress: 'Calamba, Laguna', paymentTermsDays: 45, isCompany: true },
  { code: 'CUS-003', name: 'Sunrise Hospitality Group', email: 'ap@sunrise-demo.example', phone: '+63 32 555 0103', billingAddress: 'Cebu IT Park, Cebu City', paymentTermsDays: 30 },
];

const SUPPLIERS = [
  { code: 'SUP-001', name: 'Pioneer Cement Trading', category: 'Cement', phone: '+63 2 8555 0201', email: 'sales@pioneer-demo.example', accredited: true },
  { code: 'SUP-002', name: 'Luzon Steel Works Inc.', category: 'Steel', phone: '+63 2 8555 0202', email: 'orders@luzonsteel-demo.example', accredited: true },
  { code: 'SUP-003', name: 'BrightWire Electrical Supply', category: 'Electrical', phone: '+63 2 8555 0203', email: 'sales@brightwire-demo.example', accredited: false },
  { code: 'SUP-004', name: 'AquaFlow Plumbing Depot', category: 'Plumbing', phone: '+63 2 8555 0204', email: 'hello@aquaflow-demo.example', accredited: true },
];

const ITEMS = [
  { sku: 'CEM-001', name: 'Portland Cement 40kg', category: 'Cement & Aggregates', unit: 'BAG', cost: 285, min: 200, supplier: 'SUP-001' },
  { sku: 'AGG-001', name: 'Washed Sand', category: 'Cement & Aggregates', unit: 'M3', cost: 1200, min: 20, supplier: 'SUP-001' },
  { sku: 'AGG-002', name: 'Crushed Gravel 3/4"', category: 'Cement & Aggregates', unit: 'M3', cost: 1450, min: 20, supplier: 'SUP-001' },
  { sku: 'STL-001', name: 'Deformed Rebar 12mm x 6m', category: 'Steel & Rebar', unit: 'PCS', cost: 420, min: 300, supplier: 'SUP-002' },
  { sku: 'STL-002', name: 'Deformed Rebar 16mm x 6m', category: 'Steel & Rebar', unit: 'PCS', cost: 745, min: 200, supplier: 'SUP-002' },
  { sku: 'STL-003', name: 'Tie Wire #16', category: 'Steel & Rebar', unit: 'KG', cost: 78, min: 100, supplier: 'SUP-002' },
  { sku: 'ELC-001', name: 'THHN Wire 3.5mm2 (150m roll)', category: 'Electrical', unit: 'PCS', cost: 3850, min: 10, supplier: 'SUP-003' },
  { sku: 'ELC-002', name: 'PVC Conduit 20mm x 3m', category: 'Electrical', unit: 'PCS', cost: 62, min: 150, supplier: 'SUP-003' },
  { sku: 'PLB-001', name: 'PVC Pipe 4" x 3m', category: 'Plumbing', unit: 'PCS', cost: 540, min: 40, supplier: 'SUP-004' },
  { sku: 'PLB-002', name: 'Gate Valve 1/2"', category: 'Plumbing', unit: 'PCS', cost: 215, min: 30, supplier: 'SUP-004' },
  { sku: 'PPE-001', name: 'Safety Helmet', category: 'Safety & PPE', unit: 'PCS', cost: 180, min: 50, supplier: null },
  { sku: 'PPE-002', name: 'Safety Harness', category: 'Safety & PPE', unit: 'PCS', cost: 1650, min: 10, supplier: null },
];

const PROJECTS = [
  { code: 'PRJ-2026-001', name: 'Metro Heights Tower A', customer: 'CUS-001', type: 'GENERAL_BUILDING', status: 'ACTIVE', location: 'Makati City', amount: 185_000_000, progress: 42 },
  { code: 'PRJ-2026-002', name: 'Laguna Provincial Road Widening', customer: 'CUS-002', type: 'ROADS', status: 'ACTIVE', location: 'Calamba, Laguna', amount: 96_500_000, progress: 28, sector: 'GOVERNMENT' },
  { code: 'PRJ-2026-003', name: 'Sunrise Resort Fit-Out', customer: 'CUS-003', type: 'FIT_OUT', status: 'PIPELINE', location: 'Cebu City', amount: 38_750_000, progress: 0 },
] as const;

async function main(): Promise<void> {
  const company = await prisma.company.findUnique({ where: { code: 'DEMO' } });
  if (!company) throw new Error('Company DEMO not found. Run the base seed (prisma:seed) first.');
  const companyId = company.id;

  const year = new Date().getFullYear();
  await prisma.accountingPeriod.createMany({
    data: Array.from({ length: 12 }, (_, i) => {
      const { start, end } = manilaMonthRange(year, i + 1);
      return { companyId, year, month: i + 1, startDate: start, endDate: end };
    }),
    skipDuplicates: true,
  });

  for (const u of UNITS) {
    await prisma.unitOfMeasure.upsert({ where: { companyId_code: { companyId, code: u.code } }, update: {}, create: { companyId, ...u } });
  }

  const categoryIds = new Map<string, string>();
  for (const name of CATEGORIES) {
    const existing = await prisma.itemCategory.findFirst({ where: { companyId, parentId: null, name } });
    const category = existing ?? (await prisma.itemCategory.create({ data: { companyId, name } }));
    categoryIds.set(name, category.id);
  }

  const customerIds = new Map<string, string>();
  for (const c of CUSTOMERS) {
    const customer = await prisma.customer.upsert({ where: { companyId_code: { companyId, code: c.code } }, update: {}, create: { companyId, ...c } });
    customerIds.set(c.code, customer.id);
  }

  const supplierIds = new Map<string, string>();
  for (const s of SUPPLIERS) {
    const supplier = await prisma.supplier.upsert({ where: { companyId_code: { companyId, code: s.code } }, update: {}, create: { companyId, ...s } });
    supplierIds.set(s.code, supplier.id);
  }

  for (const i of ITEMS) {
    await prisma.item.upsert({
      where: { companyId_sku: { companyId, sku: i.sku } },
      update: {},
      create: {
        companyId,
        sku: i.sku,
        name: i.name,
        categoryId: categoryIds.get(i.category),
        preferredSupplierId: i.supplier ? supplierIds.get(i.supplier) : undefined,
        baseUnit: i.unit,
        standardCost: i.cost,
        lastPurchaseCost: i.cost,
        minStock: i.min,
        reorderPoint: i.min * 1.5,
      },
    });
  }

  const costCenter = await prisma.costCenter.upsert({
    where: { companyId_code: { companyId, code: 'CC-OPS' } },
    update: {},
    create: { companyId, code: 'CC-OPS', name: 'Operations' },
  });

  const admin = await prisma.user.findFirst({ where: { companyId, isSuperAdmin: true }, select: { id: true } });
  for (const p of PROJECTS) {
    const customerId = customerIds.get(p.customer);
    if (!customerId) throw new Error(`Customer ${p.customer} missing`);
    await prisma.project.upsert({
      where: { companyId_code: { companyId, code: p.code } },
      update: {},
      create: {
        companyId,
        customerId,
        costCenterId: costCenter.id,
        managerId: admin?.id,
        code: p.code,
        name: p.name,
        type: p.type,
        status: p.status,
        sector: 'sector' in p ? p.sector : 'PRIVATE',
        location: p.location,
        contractAmount: p.amount,
        progressPct: p.progress,
        startDate: new Date(Date.UTC(year, 0, 15)),
        originalEndDate: new Date(Date.UTC(year + 1, 5, 30)),
      },
    });
  }

  await prisma.warehouse.upsert({
    where: { companyId_code: { companyId, code: 'WH-MAIN' } },
    update: {},
    create: { companyId, code: 'WH-MAIN', name: 'Main Warehouse', type: 'CENTRAL', address: 'Quezon City' },
  });

  console.log(`Demo data ready: ${CUSTOMERS.length} customers, ${SUPPLIERS.length} suppliers, ${ITEMS.length} items, ${PROJECTS.length} projects, accounting year ${year} open.`);
}

main()
  .catch((e: unknown) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
