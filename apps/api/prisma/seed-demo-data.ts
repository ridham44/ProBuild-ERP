/**
 * Fills every screen with realistic demo data by calling the real HTTP API as the admin, so numbering,
 * approvals, stock ledger and project cost all behave exactly as in production.
 *
 *   pnpm --filter @probuild/api prisma:seed:demo-data
 *
 * Env: API_BASE (default http://localhost:4000/v1), DEMO_EMAIL, DEMO_PASSWORD, DEMO_ORIGIN.
 * Run `prisma:seed` and `prisma:seed:demo` first. Safe to run twice: master data is find-or-create and the
 * document flows are skipped when they already exist.
 */
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';

if (existsSync('../../.env')) process.loadEnvFile('../../.env');

const API = process.env.API_BASE ?? 'http://localhost:4000/v1';
const EMAIL = process.env.DEMO_EMAIL ?? 'admin@probuild.local';
const PASSWORD = process.env.DEMO_PASSWORD ?? process.env.SEED_ADMIN_PASSWORD ?? 'Demo@Pass1234';
const ORIGIN = process.env.DEMO_ORIGIN ?? 'http://localhost:3000';
const DEMO_USER_PASSWORD = 'Demo@Pass1234';

type Json = Record<string, any>; // API responses are explored at runtime in this one-off demo script, not modelled

let cookie = '';

async function login(email = EMAIL, password = PASSWORD): Promise<void> {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: ORIGIN },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`Login failed (${res.status}): ${await res.text()}`);
  cookie = res.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
}

async function call<T = Json>(method: string, path: string, body?: unknown, ok: number[] = [200, 201]): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { 'content-type': 'application/json', origin: ORIGIN, cookie, ...(method === 'POST' ? { 'idempotency-key': randomUUID() } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  if (!ok.includes(res.status)) throw new Error(`${method} ${path} -> ${res.status}\n${text.slice(0, 700)}\nbody: ${JSON.stringify(body)?.slice(0, 500)}`);
  return (text ? JSON.parse(text) : {}) as T;
}
const get = <T = Json>(path: string) => call<T>('GET', path);
const post = <T = Json>(path: string, body?: unknown) => call<T>('POST', path, body ?? {});
const patch = <T = Json>(path: string, body: unknown) => call<T>('PATCH', path, body);
const put = <T = Json>(path: string, body: unknown) => call<T>('PUT', path, body);

const DAY = 86_400_000;
/** ISO timestamp `days` from now (negative = in the past). */
const at = (days: number): string => new Date(Date.now() + days * DAY).toISOString();

/** List endpoints answer either `{ items }` (paged) or a bare array. */
const rows = (res: unknown): Json[] => (Array.isArray(res) ? res : ((res as Json)?.items ?? []));

async function list(path: string, search?: string): Promise<Json[]> {
  const sep = path.includes('?') ? '&' : '?';
  return rows(await get(`${path}${sep}limit=100${search ? `&search=${encodeURIComponent(search)}` : ''}`));
}

/** Finds a record by a field in the list endpoint, otherwise creates it. */
async function ensure(listPath: string, field: string, value: string, create: () => Promise<Json>): Promise<Json> {
  const found = (await list(listPath)).find((r) => r[field] === value);
  return found ?? create();
}

function log(msg: string): void {
  console.log(`  ${msg}`);
}
function section(title: string): void {
  console.log(`\n== ${title}`);
}

/** Runs approve until the document leaves the approval chain (multi-step workflows need several approvals). */
async function approveFully(path: string, doneStatuses: string[]): Promise<Json> {
  let doc: Json = {};
  for (let i = 0; i < 5; i++) {
    doc = await post(`${path}/approve`, { comment: 'Approved - demo data' });
    if (doneStatuses.includes(doc.status)) return doc;
  }
  throw new Error(`${path} did not reach ${doneStatuses.join('/')}; last status ${doc.status}`);
}

// ---------------------------------------------------------------------------------------------------
// Master data
// ---------------------------------------------------------------------------------------------------
interface Ctx {
  users: Record<string, Json>;
  roles: Record<string, Json>;
  customers: Record<string, Json>;
  suppliers: Record<string, Json>;
  items: Record<string, Json>;
  projects: Record<string, Json>;
  warehouses: Record<string, Json>;
  wbs: Record<string, Json>;
  costCodes: Record<string, Json>;
}
const ctx: Ctx = { users: {}, roles: {}, customers: {}, suppliers: {}, items: {}, projects: {}, warehouses: {}, wbs: {}, costCodes: {} };

async function loadBase(): Promise<void> {
  for (const c of await list('/customers')) ctx.customers[c.code] = c;
  for (const s of await list('/suppliers')) ctx.suppliers[s.code] = s;
  for (const i of await list('/items')) ctx.items[i.sku] = i;
  for (const p of await list('/projects')) ctx.projects[p.code] = p;
  for (const w of await list('/warehouses')) ctx.warehouses[w.code] = w;
  for (const r of rows(await get('/roles'))) ctx.roles[r.name] = r;
}

async function organization(): Promise<void> {
  section('Company, branches, departments, banks');
  const company = await get('/company');
  await patch('/company', {
    legalName: company.legalName,
    tradeName: 'Demo Builders',
    tin: '008-412-663-000',
    secNo: 'CS201912345',
    philgepsNo: 'PG-2024-088123',
    businessPermitNo: 'BP-QC-2026-00418',
    address: '18F Orion Tower, Ayala Avenue, Makati City, Metro Manila',
    email: 'info@demobuilders.example',
    phone: '+63 2 8888 4100',
    overReceiptTolerancePct: '5',
  });
  log('company profile filled');

  for (const b of [
    { code: 'HQ-MNL', name: 'Head Office - Makati', address: '18F Orion Tower, Ayala Avenue, Makati City' },
    { code: 'BR-CEB', name: 'Cebu Regional Office', address: 'Cebu IT Park, Lahug, Cebu City' },
    { code: 'BR-LAG', name: 'Laguna Project Office', address: 'National Highway, Calamba, Laguna' },
  ]) {
    await ensure('/branches', 'code', b.code, () => post('/branches', b));
  }
  log('3 branches');

  for (const d of [
    { code: 'ENG', name: 'Engineering' },
    { code: 'PRC', name: 'Procurement' },
    { code: 'FIN', name: 'Finance & Accounting' },
    { code: 'WHS', name: 'Warehouse & Logistics' },
    { code: 'HSE', name: 'Safety & Compliance' },
  ]) {
    await ensure('/departments', 'code', d.code, () => post('/departments', d));
  }
  for (const c of [
    { code: 'CC-HQ', name: 'Head Office Overhead' },
    { code: 'CC-MTA', name: 'Metro Heights Tower A' },
    { code: 'CC-LAG', name: 'Laguna Road Widening' },
  ]) {
    await ensure('/cost-centers', 'code', c.code, () => post('/cost-centers', c));
  }
  log('5 departments, cost centers');

  if (!rows(await get('/bank-accounts')).length) {
    await post('/bank-accounts', { bankName: 'BDO Unibank', branchName: 'Ayala Avenue', accountName: 'Demo Builders Corporation', accountNo: '0012-3456-7890', openingBalance: '15000000' });
    await post('/bank-accounts', { bankName: 'Metrobank', branchName: 'Makati Main', accountName: 'Demo Builders Corporation - Payroll', accountNo: '1234-5678-9012', openingBalance: '2500000' });
  }
  log('2 bank accounts');
}

async function warehouses(): Promise<void> {
  section('Warehouses');
  const branches = await list('/branches');
  const branchId = (code: string) => branches.find((b) => b.code === code)?.id;
  const defs = [
    { code: 'WH-MTA', name: 'Metro Heights Tower A - Site Store', type: 'SITE', projectCode: 'PRJ-2026-001', address: 'Ayala Ave, Makati City', branch: 'HQ-MNL' },
    { code: 'WH-LAG', name: 'Laguna Road Project Yard', type: 'YARD', projectCode: 'PRJ-2026-002', address: 'Calamba, Laguna', branch: 'BR-LAG' },
    { code: 'WH-TOOL', name: 'Main Tool Room', type: 'TOOL_ROOM', address: 'Quezon City', branch: 'HQ-MNL' },
    { code: 'WH-QRN', name: 'Quarantine Area', type: 'QUARANTINE', address: 'Quezon City', branch: 'HQ-MNL' },
  ];
  for (const w of defs) {
    ctx.warehouses[w.code] = await ensure('/warehouses', 'code', w.code, () =>
      post('/warehouses', { code: w.code, name: w.name, type: w.type, address: w.address, branchId: branchId(w.branch), projectId: w.projectCode ? ctx.projects[w.projectCode]?.id : undefined }),
    );
  }
  const main = ctx.warehouses['WH-MAIN'];
  await patch(`/warehouses/${main.id}`, { branchId: branchId('HQ-MNL') });
  const locs = await list(`/warehouse-locations?warehouseId=${main.id}`);
  if (!locs.length) {
    const zoneA = await post('/warehouse-locations', { warehouseId: main.id, level: 'ZONE', code: 'A' });
    const rack = await post('/warehouse-locations', { warehouseId: main.id, parentId: zoneA.id, level: 'RACK', code: 'R01' });
    await post('/warehouse-locations', { warehouseId: main.id, parentId: rack.id, level: 'SHELF', code: 'S01' });
    await post('/warehouse-locations', { warehouseId: main.id, level: 'ZONE', code: 'B' });
  }
  log('4 extra warehouses and storage locations');
}

const DEMO_USERS = [
  { email: 'maria.santos@demobuilders.example', name: 'Maria Santos', role: 'Project Manager' },
  { email: 'jose.reyes@demobuilders.example', name: 'Jose Reyes', role: 'Procurement' },
  { email: 'ana.cruz@demobuilders.example', name: 'Ana Cruz', role: 'Finance' },
  { email: 'carlo.dizon@demobuilders.example', name: 'Carlo Dizon', role: 'Warehouse Manager' },
  { email: 'liza.garcia@demobuilders.example', name: 'Liza Garcia', role: 'Site Engineer' },
  { email: 'ramon.bautista@demobuilders.example', name: 'Ramon Bautista', role: 'Quantity Surveyor' },
];

async function users(): Promise<void> {
  section('Users');
  const existing = await list('/users');
  for (const u of DEMO_USERS) {
    const found = existing.find((x) => x.email === u.email);
    const roleId = ctx.roles[u.role]?.id;
    if (!roleId) throw new Error(`Role ${u.role} not found`);
    ctx.users[u.email] = found ?? (await post('/users', { email: u.email, name: u.name, password: DEMO_USER_PASSWORD, roleIds: [roleId] }));
  }
  const prisma = new PrismaClient();
  try {
    // Demo logins should open straight on the dashboard instead of the forced password-change screen.
    await prisma.user.updateMany({ where: { email: { in: DEMO_USERS.map((u) => u.email) } }, data: { mustChangePassword: false } });
  } finally {
    await prisma.$disconnect();
  }
  log(`${DEMO_USERS.length} team members (password ${DEMO_USER_PASSWORD})`);
}

async function parties(): Promise<void> {
  section('Customers and suppliers');
  const contactSets: Record<string, Array<Record<string, unknown>>> = {
    'CUS-001': [
      { name: 'Engr. Paolo Villanueva', position: 'Project Director', email: 'paolo.v@metroheights.example', phone: '+63 917 555 0111', isPrimary: true },
      { name: 'Grace Tan', position: 'Accounts Payable', email: 'grace.t@metroheights.example', phone: '+63 917 555 0112' },
    ],
    'CUS-002': [{ name: 'Engr. Ricardo Mercado', position: 'District Engineer', email: 'r.mercado@dpwh-demo.example', phone: '+63 49 555 0113', isPrimary: true }],
    'CUS-003': [{ name: 'Isabel Chua', position: 'Development Manager', email: 'isabel.c@sunrise-demo.example', phone: '+63 32 555 0114', isPrimary: true }],
  };
  for (const [code, contacts] of Object.entries(contactSets)) {
    const customer = ctx.customers[code];
    if (!customer) continue;
    if (!rows(await get(`/customers/${customer.id}/contacts`)).length) for (const c of contacts) await post(`/customers/${customer.id}/contacts`, c);
  }

  const supplierExtras: Record<string, { tin: string; accreditation?: string; contact: Record<string, unknown>; scores: [number, number, number, number, number, number] }> = {
    'SUP-001': { tin: '210-338-471-000', accreditation: 'ACC-2026-001', contact: { name: 'Mario Dela Cruz', position: 'Sales Manager', email: 'mario@pioneer-demo.example', phone: '+63 917 555 0201', isPrimary: true }, scores: [88, 92, 90, 85, 95, 1] },
    'SUP-002': { tin: '310-552-018-000', accreditation: 'ACC-2026-002', contact: { name: 'Henry Lim', position: 'Account Executive', email: 'henry@luzonsteel-demo.example', phone: '+63 917 555 0202', isPrimary: true }, scores: [82, 95, 78, 90, 92, 2] },
    'SUP-003': { tin: '410-229-880-000', contact: { name: 'Felix Ong', position: 'Sales', email: 'felix@brightwire-demo.example', phone: '+63 917 555 0203', isPrimary: true }, scores: [75, 80, 70, 72, 85, 4] },
    'SUP-004': { tin: '510-771-904-000', accreditation: 'ACC-2026-004', contact: { name: 'Teresa Uy', position: 'Branch Manager', email: 'teresa@aquaflow-demo.example', phone: '+63 917 555 0204', isPrimary: true }, scores: [90, 88, 93, 95, 90, 0] },
  };
  for (const [code, x] of Object.entries(supplierExtras)) {
    const supplier = ctx.suppliers[code];
    if (!supplier) continue;
    await patch(`/suppliers/${supplier.id}`, { tin: x.tin, address: 'Metro Manila, Philippines', ewtCode: 'WC158', paymentTermsDays: 30 });
    if (x.accreditation) await put(`/suppliers/${supplier.id}/accreditation`, { accredited: true, accreditationNo: x.accreditation, accreditationExpiry: at(330), notes: 'Annual accreditation - demo' });
    if (!rows(await get(`/suppliers/${supplier.id}/contacts`)).length) await post(`/suppliers/${supplier.id}/contacts`, x.contact);
    if (!rows(await get(`/suppliers/${supplier.id}/evaluations`)).length) {
      const [priceScore, qualityScore, deliveryScore, responsivenessScore, complianceScore, rejectionRatePct] = x.scores;
      await post(`/suppliers/${supplier.id}/evaluations`, {
        periodStart: at(-120), periodEnd: at(-30), priceScore, qualityScore, deliveryScore, responsivenessScore, complianceScore, rejectionRatePct: String(rejectionRatePct), notes: 'Quarterly evaluation - demo',
      });
    }
  }
  log('customer + supplier contacts, accreditation, evaluations');
}

async function catalog(): Promise<void> {
  section('Item catalog');
  const cats = await list('/item-categories');
  const cat = (name: string) => cats.find((c) => c.name === name)?.id;
  const extra = [
    { sku: 'CHB-001', name: 'Concrete Hollow Block 4"', category: 'Cement & Aggregates', unit: 'PCS', cost: 14, min: 1000, supplier: 'SUP-001', desc: 'Standard 4 inch CHB for partition walls' },
    { sku: 'PLY-001', name: 'Marine Plywood 3/4" (4x8)', category: 'Steel & Rebar', unit: 'PCS', cost: 1450, min: 40, supplier: 'SUP-002', desc: 'Formwork plywood' },
    { sku: 'ELC-003', name: 'Circuit Breaker 20A', category: 'Electrical', unit: 'PCS', cost: 385, min: 25, supplier: 'SUP-003', desc: 'Single-pole MCB' },
    { sku: 'GRT-001', name: 'Epoxy Grout 5kg (batch + expiry)', category: 'Cement & Aggregates', unit: 'PCS', cost: 920, min: 10, supplier: 'SUP-001', desc: 'Non-shrink grout; expiry tracked', batch: true },
    { sku: 'TLS-001', name: 'Rotary Hammer Drill (serialized)', category: 'Safety & PPE', unit: 'PCS', cost: 18500, min: 2, supplier: null, desc: 'Power tool tracked by serial number', serial: true, itemType: 'SERIALIZED' },
  ];
  for (const e of extra) {
    ctx.items[e.sku] = await ensure('/items', 'sku', e.sku, () =>
      post('/items', {
        sku: e.sku, name: e.name, description: e.desc, categoryId: cat(e.category), preferredSupplierId: e.supplier ? ctx.suppliers[e.supplier]?.id : undefined,
        baseUnit: e.unit, standardCost: String(e.cost), minStock: String(e.min), reorderPoint: String(Math.round(e.min * 1.5)), maxStock: String(e.min * 6),
        trackBatch: e.batch ?? false, trackExpiry: e.batch ?? false, trackSerial: e.serial ?? false, itemType: e.itemType ?? (e.batch ? 'BATCH_CONTROLLED' : 'CONSUMABLE'),
      }),
    );
  }
  const cement = ctx.items['CEM-001'];
  const conv = await get<Json>(`/items/${cement.id}`);
  if (!(conv.unitConversions ?? []).length) await put(`/items/${cement.id}/unit-conversions`, { unit: 'PALLET', factor: '56' }).catch(() => undefined);
  log(`${extra.length} more items (batch + serial tracked included)`);
}

async function projectSetup(): Promise<void> {
  section('Projects: team, contracts, WBS, cost codes, estimate/BOQ');
  const [maria, liza, ramon, jose] = ['maria.santos', 'liza.garcia', 'ramon.bautista', 'jose.reyes'].map((n) => ctx.users[`${n}@demobuilders.example`]);
  const p1 = ctx.projects['PRJ-2026-001'];
  const p2 = ctx.projects['PRJ-2026-002'];
  const p3 = ctx.projects['PRJ-2026-003'];
  await patch(`/projects/${p1.id}`, { managerId: maria.id, retentionPct: '10', advancePct: '15', warrantyMonths: 12, ldRatePct: '0.1', paymentTerms: 'Progress billing every 30 days', fundingSource: 'Private equity + bank loan' });
  await patch(`/projects/${p2.id}`, { managerId: maria.id, retentionPct: '10', advancePct: '15', warrantyMonths: 24, ldRatePct: '0.1', paymentTerms: 'Per DPWH progress billing', fundingSource: 'General Appropriations Act' });
  await patch(`/projects/${p3.id}`, { retentionPct: '5', paymentTerms: 'Milestone based' });

  for (const [project, members] of [
    [p1, [[maria, 'Project Manager'], [liza, 'Site Engineer'], [ramon, 'Quantity Surveyor'], [jose, 'Procurement Officer']]],
    [p2, [[maria, 'Project Manager'], [liza, 'Site Engineer'], [ramon, 'Quantity Surveyor']]],
  ] as Array<[Json, Array<[Json, string]>]>) {
    if (rows(await get(`/projects/${project.id}/members`)).length) continue;
    for (const [u, role] of members) await post(`/projects/${project.id}/members`, { userId: u.id, role });
  }

  for (const [project, title, amount] of [
    [p1, 'Main Construction Contract - Metro Heights Tower A', '185000000'],
    [p2, 'Road Widening Contract - Laguna Provincial Road', '96500000'],
  ] as Array<[Json, string, string]>) {
    if (rows(await get(`/projects/${project.id}/contracts`)).length) continue;
    const c = await post(`/projects/${project.id}/contracts`, { title, contractType: 'UNIT_PRICE', originalAmount: amount, signedDate: at(-90), noticeToProceed: at(-80), clauses: 'Retention 10%. Liquidated damages 0.1% per day of delay.' });
    await post(`/contracts/${c.id}/activate`);
  }

  // Cost codes
  for (const c of [
    { code: 'MAT-CON', name: 'Concrete & Masonry Materials', category: 'MATERIAL' },
    { code: 'MAT-STL', name: 'Reinforcing Steel & Formwork', category: 'MATERIAL' },
    { code: 'MAT-ELE', name: 'Electrical Materials', category: 'MATERIAL' },
    { code: 'MAT-PLB', name: 'Plumbing Materials', category: 'MATERIAL' },
    { code: 'LAB-DIR', name: 'Direct Labor', category: 'LABOR' },
    { code: 'EQP-RNT', name: 'Equipment Rental', category: 'EQUIPMENT' },
    { code: 'SUB-GEN', name: 'Subcontract Works', category: 'SUBCONTRACT' },
    { code: 'OTH-HSE', name: 'Safety & Site Overhead', category: 'OTHER' },
  ]) {
    ctx.costCodes[c.code] = await ensure('/cost-codes', 'code', c.code, () => post('/cost-codes', c));
  }

  // WBS for the two active projects
  for (const [project, key] of [[p1, 'P1'], [p2, 'P2']] as Array<[Json, string]>) {
    const flat = flatten(rows(await get(`/projects/${project.id}/wbs`)));
    if (flat.length) {
      for (const n of flat) ctx.wbs[`${key}:${n.code}`] = n;
      continue;
    }
    const tree: Array<{ code: string; name: string; children: Array<[string, string]> }> =
      key === 'P1'
        ? [
            { code: '1', name: 'Site Works', children: [['1.1', 'Excavation & Earthworks'], ['1.2', 'Temporary Facilities']] },
            { code: '2', name: 'Structural Works', children: [['2.1', 'Foundation'], ['2.2', 'Columns & Slabs'], ['2.3', 'Masonry']] },
            { code: '3', name: 'MEP Works', children: [['3.1', 'Electrical'], ['3.2', 'Plumbing']] },
          ]
        : [
            { code: '1', name: 'Roadway', children: [['1.1', 'Clearing & Grubbing'], ['1.2', 'Subgrade & Base Course'], ['1.3', 'Concrete Pavement']] },
            { code: '2', name: 'Drainage', children: [['2.1', 'Reinforced Concrete Pipe Culverts']] },
          ];
    for (const root of tree) {
      const parent = await post(`/projects/${project.id}/wbs`, { code: root.code, name: root.name });
      ctx.wbs[`${key}:${root.code}`] = parent;
      for (const [code, name] of root.children) ctx.wbs[`${key}:${code}`] = await post(`/projects/${project.id}/wbs`, { parentId: parent.id, code, name });
    }
  }

  // Estimate + BOQ -> approved budget
  for (const [project, key] of [[p1, 'P1'], [p2, 'P2']] as Array<[Json, string]>) {
    if (rows(await get(`/projects/${project.id}/estimates`)).length) continue;
    const est = await post(`/projects/${project.id}/estimates`, { name: 'Detailed estimate v1', type: 'DETAILED', overheadPct: '8', profitPct: '10', taxPct: '12' });
    const boq =
      key === 'P1'
        ? [
            ['2.1', 'MAT-CON', 'B-001', 'Structural concrete 4000 psi', 'M3', '850', '5800'],
            ['2.1', 'MAT-STL', 'B-002', 'Rebar 16mm', 'PCS', '4200', '745'],
            ['2.2', 'MAT-STL', 'B-003', 'Rebar 12mm', 'PCS', '6500', '420'],
            ['2.3', 'MAT-CON', 'B-004', 'CHB 4" laying', 'PCS', '38000', '14'],
            ['3.1', 'MAT-ELE', 'B-005', 'THHN wire 3.5mm2', 'PCS', '120', '3850'],
            ['3.2', 'MAT-PLB', 'B-006', 'PVC pipe 4"', 'PCS', '600', '540'],
          ]
        : [
            ['1.2', 'MAT-CON', 'R-001', 'Cement for base course stabilization', 'BAG', '12000', '285'],
            ['1.3', 'MAT-STL', 'R-002', 'Dowel & tie bars 16mm', 'PCS', '5200', '745'],
            ['2.1', 'MAT-CON', 'R-003', 'Gravel 3/4" for culvert bedding', 'M3', '900', '1450'],
          ];
    for (const [wbsCode, ccCode, itemNo, description, unit, quantity, unitRate] of boq) {
      await post(`/estimates/${est.id}/items`, {
        section: ccCode.startsWith('MAT') ? 'Materials' : 'Works', itemNo, description, costCategory: 'MATERIAL', unit, quantity, unitRate,
        wbsNodeId: ctx.wbs[`${key}:${wbsCode}`]?.id, costCodeId: ctx.costCodes[ccCode].id,
      });
    }
    await post(`/estimates/${est.id}/approve`);
  }
  log('team members, 2 active contracts, WBS trees, 8 cost codes, approved estimates + BOQ + budgets');
}

function flatten(nodes: Json[]): Json[] {
  return nodes.flatMap((n) => [n, ...flatten(n.children ?? [])]);
}

// ---------------------------------------------------------------------------------------------------
// Document flows
// ---------------------------------------------------------------------------------------------------
const sku = (code: string): string => {
  const item = ctx.items[code];
  if (!item) throw new Error(`Item ${code} missing`);
  return item.id as string;
};
const wbsId = (key: string): string | undefined => ctx.wbs[key]?.id;
const ccId = (code: string): string => ctx.costCodes[code].id as string;

interface ReqLine {
  sku: string;
  qty: number;
  wbs?: string;
  cc?: string;
  note?: string;
  cost?: number;
}

async function requisition(projectCode: string, warehouseCode: string, purpose: string, lines: ReqLine[], priority = 'NORMAL'): Promise<Json> {
  return post('/requisitions', {
    projectId: ctx.projects[projectCode].id,
    warehouseId: ctx.warehouses[warehouseCode].id,
    priority,
    requiredDate: at(14),
    purpose: `DEMO - ${purpose}`,
    remarks: 'Demo data',
    lines: lines.map((l) => ({
      itemId: sku(l.sku),
      qty: String(l.qty),
      requiredDate: at(14),
      wbsNodeId: l.wbs ? wbsId(l.wbs) : undefined,
      costCodeId: l.cc ? ccId(l.cc) : undefined,
      justification: l.note,
      estimatedUnitCost: l.cost ? String(l.cost) : undefined,
    })),
  });
}

async function submitAndApprove(path: string, doc: Json, approvedStatuses = ['APPROVED']): Promise<Json> {
  const submitted = await post(`${path}/${doc.id}/submit`);
  if (approvedStatuses.includes(submitted.status)) return submitted;
  return approveFully(`${path}/${doc.id}`, approvedStatuses);
}

/** Creates an RFQ for a requisition, sends it and records one quotation per supplier (price factor per supplier). */
async function rfqWithQuotes(req: Json, supplierCodes: string[], quotes: Record<string, number> | null, label: string): Promise<{ rfq: Json; quotations: Record<string, Json> }> {
  const reqDetail = await get(`/requisitions/${req.id}`);
  const rfq = await post('/rfqs', {
    requisitionId: req.id,
    supplierIds: supplierCodes.map((c) => ctx.suppliers[c].id),
    lines: reqDetail.lines.map((l: Json) => ({ requisitionLineId: l.id })),
    dueDate: at(5),
    requiredDate: at(14),
    deliveryRequirements: 'Delivered and unloaded at site storage. Include mill certificates where applicable.',
    deliveryLocation: 'Project site storage',
    remarks: label,
  });
  await post(`/rfqs/${rfq.id}/send`);
  const quotations: Record<string, Json> = {};
  if (quotes) {
    const rfqDetail = await get(`/rfqs/${rfq.id}`);
    for (const code of supplierCodes) {
      const factor = quotes[code];
      if (!factor) continue;
      quotations[code] = await post(`/rfqs/${rfq.id}/quotations`, {
        supplierId: ctx.suppliers[code].id,
        quoteNo: `Q-${code.slice(-3)}-${Math.floor(Math.random() * 900 + 100)}`,
        quoteDate: at(-1),
        validUntil: at(20),
        deliveryDays: 5 + Math.round(factor * 3),
        paymentTerms: '30 days after delivery',
        warranty: 'Manufacturer warranty',
        freight: '0',
        lines: rfqDetail.lines.map((rl: Json) => {
          const reqLine = reqDetail.lines.find((l: Json) => l.id === rl.requisitionLineId);
          const base = Number(reqLine?.estimatedUnitCost ?? 100);
          return { rfqLineId: rl.id, unitPrice: (Math.round(base * factor * 100) / 100).toFixed(2), taxPct: '12', discountPct: factor < 1 ? '2' : '0' };
        }),
      });
    }
  }
  return { rfq: await get(`/rfqs/${rfq.id}`), quotations };
}

/** PO lines straight from an approved requisition, priced from the requisition estimate. */
async function directPo(req: Json, supplierCode: string, warehouseCode: string, daysAgo: number, expectedIn: number): Promise<Json> {
  const detail = await get(`/requisitions/${req.id}`);
  return post('/purchase-orders', {
    source: 'REQUISITION',
    requisitionId: req.id,
    supplierId: ctx.suppliers[supplierCode].id,
    warehouseId: ctx.warehouses[warehouseCode].id,
    orderDate: at(-daysAgo),
    expectedDate: at(expectedIn),
    paymentTerms: '30 days after delivery',
    lines: detail.lines.map((l: Json) => ({ requisitionLineId: l.id, qty: String(l.qty), unitPrice: String(Number(l.estimatedUnitCost ?? 100)), taxPct: '12' })),
  });
}

interface ReceiveOptions {
  dr: string;
  vehicle: string;
  driver: string;
  rejectFirst?: number;
  batchFor?: Record<string, { batchNo: string; expiry: string }>;
  serials?: Record<string, string[]>;
  post?: boolean;
  inspect?: boolean;
}

async function receive(po: Json, fraction: number, opts: ReceiveOptions): Promise<Json> {
  const detail = await get(`/purchase-orders/${po.id}`);
  const skuById = new Map(Object.values(ctx.items).map((i) => [i.id as string, i.sku as string]));
  const grn = await post('/goods-receipts', {
    orderId: po.id,
    receiptDate: at(-1),
    supplierDrNo: opts.dr,
    vehicle: opts.vehicle,
    driver: opts.driver,
    remarks: 'Delivered with supplier delivery receipt',
    lines: detail.lines.map((l: Json, idx: number) => {
      const code = skuById.get(l.itemId) ?? '';
      const serials = opts.serials?.[code];
      const batch = opts.batchFor?.[code];
      const rejected = idx === 0 && opts.rejectFirst ? opts.rejectFirst : 0;
      return {
        orderLineId: l.id,
        receivedQty: String(serials ? serials.length : Math.max(1, Math.floor(Number(l.qty) * fraction))),
        rejectedQty: rejected ? String(rejected) : undefined,
        rejectionReason: rejected ? 'Bent bars / damaged on arrival' : undefined,
        batchNo: batch?.batchNo,
        expiryDate: batch?.expiry,
        serialNos: serials,
      };
    }),
  });
  const full = await get(`/goods-receipts/${grn.id}`);
  if (opts.inspect !== false) {
    for (const line of full.lines) {
      if (Number(line.rejectedQty ?? 0) > 0) {
        await put(`/goods-receipts/${grn.id}/lines/${line.id}/inspection`, {
          outcome: 'PARTIAL',
          acceptedQty: String(Number(line.receivedQty) - Number(line.rejectedQty)),
          rejectedQty: String(line.rejectedQty),
          quarantineQty: '0',
          reason: 'Some bars bent beyond tolerance; returned to supplier',
          remarks: 'Partial acceptance',
          testResult: 'Rejected lot sample failed bend test',
        });
        continue;
      }
      await put(`/goods-receipts/${grn.id}/lines/${line.id}/inspection`, {
        outcome: 'PASS',
        remarks: 'Visual and dimensional check OK',
        testResult: 'Within tolerance',
        certificateNo: `QC-${Math.floor(Math.random() * 9000 + 1000)}`,
        checklist: [
          { item: 'Quantity matches delivery receipt', passed: true },
          { item: 'No visible damage', passed: true },
        ],
      });
    }
  }
  if (opts.post !== false) await post(`/goods-receipts/${grn.id}/post`, {});
  return get(`/goods-receipts/${grn.id}`);
}

async function procurementFlows(): Promise<void> {
  section('Procurement: requisitions, RFQs, quotations, purchase orders, goods receipts');
  if ((await list('/requisitions', 'DEMO')).length) {
    log('procurement demo documents already exist - skipped');
    return;
  }
  const P1 = 'PRJ-2026-001';
  const P2 = 'PRJ-2026-002';

  // F1: steel for the tower - RFQ with 3 quotations, award, PO, first partial delivery with some rejects
  const steelReq = await requisition(P1, 'WH-MAIN', 'Reinforcing steel for Level 3 slab', [
    { sku: 'STL-002', qty: 400, wbs: 'P1:2.2', cc: 'MAT-STL', note: 'Beams and girders' },
    { sku: 'STL-001', qty: 600, wbs: 'P1:2.2', cc: 'MAT-STL', note: 'Slab main bars' },
    { sku: 'STL-003', qty: 300, wbs: 'P1:2.2', cc: 'MAT-STL' },
  ], 'HIGH');
  await submitAndApprove('/requisitions', steelReq);
  const steel = await rfqWithQuotes(steelReq, ['SUP-002', 'SUP-001', 'SUP-004'], { 'SUP-002': 0.97, 'SUP-001': 1.04, 'SUP-004': 1.09 }, 'Level 3 slab steel');
  await post(`/rfqs/${steel.rfq.id}/award`, { quotationId: steel.quotations['SUP-002'].id, reason: 'Lowest evaluated price and best delivery lead time' });
  const po1 = await post('/purchase-orders', {
    source: 'QUOTATION', quotationId: steel.quotations['SUP-002'].id, warehouseId: ctx.warehouses['WH-MAIN'].id,
    orderDate: at(-3), expectedDate: at(7), deliveryLocation: 'Main Warehouse, Quezon City', paymentTerms: '30 days after delivery',
    terms: 'Goods subject to QC inspection on delivery. Supplier delivery receipt must accompany every shipment.',
  });
  await submitAndApprove('/purchase-orders', po1);
  await post(`/purchase-orders/${po1.id}/send`);
  await receive(po1, 0.6, { dr: 'LSW-DR-20418', vehicle: 'Truck NBC 4821', driver: 'Roberto Aquino', rejectFirst: 8 });
  log('steel: requisition -> RFQ (3 quotes) -> award -> PO -> first delivery posted (PO partly received)');

  // F2: concrete materials bought from the requisition (no RFQ), fully received
  const concreteReq = await requisition(P1, 'WH-MAIN', 'Cement, sand and gravel for columns', [
    { sku: 'CEM-001', qty: 900, wbs: 'P1:2.2', cc: 'MAT-CON' },
    { sku: 'AGG-001', qty: 60, wbs: 'P1:2.2', cc: 'MAT-CON' },
    { sku: 'AGG-002', qty: 60, wbs: 'P1:2.2', cc: 'MAT-CON' },
    { sku: 'CHB-001', qty: 6000, wbs: 'P1:2.3', cc: 'MAT-CON' },
  ]);
  await submitAndApprove('/requisitions', concreteReq);
  const po2 = await directPo(concreteReq, 'SUP-001', 'WH-MAIN', 6, 2);
  await submitAndApprove('/purchase-orders', po2);
  await post(`/purchase-orders/${po2.id}/send`);
  await receive(po2, 1, { dr: 'PCT-DR-77310', vehicle: 'Mixer truck TXA 902', driver: 'Dennis Alvarez' });
  log('concrete materials: requisition -> direct PO -> fully received');

  // F3: Laguna road - batch- and serial-tracked items received with batch/expiry and serial numbers
  const lagunaReq = await requisition(P2, 'WH-LAG', 'Grout and equipment for culvert works', [
    { sku: 'GRT-001', qty: 40, wbs: 'P2:2.1', cc: 'MAT-CON', cost: 920 },
    { sku: 'TLS-001', qty: 2, wbs: 'P2:2.1', cc: 'EQP-RNT', cost: 18500 },
  ]);
  await submitAndApprove('/requisitions', lagunaReq);
  const po3 = await directPo(lagunaReq, 'SUP-001', 'WH-LAG', 5, 3);
  await submitAndApprove('/purchase-orders', po3);
  await post(`/purchase-orders/${po3.id}/send`);
  await receive(po3, 1, {
    dr: 'PCT-DR-77355', vehicle: 'Van ABX 1190', driver: 'Mark Salazar',
    batchFor: { 'GRT-001': { batchNo: 'GRT-2026-09-A', expiry: at(365) } },
    serials: { 'TLS-001': ['RHD-24-0001', 'RHD-24-0002'] },
  });
  log('batch + serial items received (batch number, expiry date, serial numbers)');

  // F4: MEP - RFQ sent, one quotation in so far (status QUOTED)
  const mepReq = await requisition(P1, 'WH-MAIN', 'Electrical and plumbing rough-in, Levels 1-3', [
    { sku: 'ELC-001', qty: 12, wbs: 'P1:3.1', cc: 'MAT-ELE' },
    { sku: 'ELC-002', qty: 400, wbs: 'P1:3.1', cc: 'MAT-ELE' },
    { sku: 'ELC-003', qty: 60, wbs: 'P1:3.1', cc: 'MAT-ELE' },
    { sku: 'PLB-001', qty: 120, wbs: 'P1:3.2', cc: 'MAT-PLB' },
    { sku: 'PLB-002', qty: 50, wbs: 'P1:3.2', cc: 'MAT-PLB' },
  ], 'URGENT');
  await submitAndApprove('/requisitions', mepReq);
  await rfqWithQuotes(mepReq, ['SUP-004', 'SUP-001'], { 'SUP-004': 1 }, 'MEP rough-in - waiting for second quote');
  log('MEP: RFQ sent, one quotation received');

  // F5: RFQ sent, no quotation yet
  const roadReq = await requisition(P2, 'WH-LAG', 'Cement and gravel for road base course', [
    { sku: 'CEM-001', qty: 3000, wbs: 'P2:1.2', cc: 'MAT-CON' },
    { sku: 'AGG-002', qty: 200, wbs: 'P2:1.2', cc: 'MAT-CON' },
  ]);
  await submitAndApprove('/requisitions', roadReq);
  await rfqWithQuotes(roadReq, ['SUP-001', 'SUP-002'], null, 'Road base course - quotes due');
  log('road base course: RFQ sent, waiting for quotations');

  // F6: PO sent, partial delivery logged as a draft receipt waiting for QC
  const sentReq = await requisition(P2, 'WH-LAG', 'Tie bars for pavement joints', [{ sku: 'STL-002', qty: 500, wbs: 'P2:1.3', cc: 'MAT-STL' }]);
  await submitAndApprove('/requisitions', sentReq);
  const po4 = await directPo(sentReq, 'SUP-002', 'WH-LAG', 2, 6);
  await submitAndApprove('/purchase-orders', po4);
  await post(`/purchase-orders/${po4.id}/send`);
  await receive(po4, 0.4, { dr: 'LSW-DR-20455', vehicle: 'Truck NCD 7733', driver: 'Eric Pascual', inspect: false, post: false });
  log('tie bars: PO sent, delivery logged as a draft receipt waiting for QC');

  // Approval queue and status variety
  const pending = await requisition(P1, 'WH-MAIN', 'Formwork plywood for Level 4', [{ sku: 'PLY-001', qty: 220, wbs: 'P1:2.2', cc: 'MAT-STL' }], 'HIGH');
  await post(`/requisitions/${pending.id}/submit`);
  await requisition(P1, 'WH-MTA', 'Site safety gear top-up', [{ sku: 'PPE-001', qty: 60, cc: 'OTH-HSE' }, { sku: 'PPE-002', qty: 12, cc: 'OTH-HSE' }]);
  const rejectedReq = await requisition(P2, 'WH-LAG', 'Extra drill purchase', [{ sku: 'TLS-001', qty: 6, cc: 'EQP-RNT', cost: 18500 }]);
  await post(`/requisitions/${rejectedReq.id}/submit`);
  await post(`/requisitions/${rejectedReq.id}/reject`, { comment: 'Use the existing rental units first; resubmit with justification' });
  const cancelledReq = await requisition(P1, 'WH-MTA', 'Duplicate request (raised twice)', [{ sku: 'CEM-001', qty: 100, cc: 'MAT-CON' }]);
  await post(`/requisitions/${cancelledReq.id}/cancel`, { reason: 'Duplicate of an approved request' });

  const draftPoReq = await requisition(P1, 'WH-MAIN', 'Conduit and breakers for Level 4', [
    { sku: 'ELC-002', qty: 250, wbs: 'P1:3.1', cc: 'MAT-ELE' },
    { sku: 'ELC-003', qty: 40, wbs: 'P1:3.1', cc: 'MAT-ELE' },
  ]);
  await submitAndApprove('/requisitions', draftPoReq);
  await directPo(draftPoReq, 'SUP-003', 'WH-MAIN', 0, 10);
  const pendReq = await requisition(P2, 'WH-LAG', 'PVC pipe for drainage lines', [{ sku: 'PLB-001', qty: 150, wbs: 'P2:2.1', cc: 'MAT-PLB' }]);
  await submitAndApprove('/requisitions', pendReq);
  const poPending = await directPo(pendReq, 'SUP-004', 'WH-LAG', 0, 12);
  await post(`/purchase-orders/${poPending.id}/submit`);
  log('queue variety: requisitions in draft / awaiting approval / rejected / cancelled; POs in draft and awaiting approval');
}

// ---------------------------------------------------------------------------------------------------
// Stock and materials flows
// ---------------------------------------------------------------------------------------------------
async function materialRequest(projectCode: string, warehouseCode: string, purpose: string, lines: Array<{ sku: string; qty: number; wbs?: string; cc?: string; note?: string }>): Promise<Json> {
  return post('/material-requests', {
    projectId: ctx.projects[projectCode].id,
    warehouseId: ctx.warehouses[warehouseCode].id,
    neededDate: at(3),
    purpose: `DEMO - ${purpose}`,
    remarks: 'Demo data',
    lines: lines.map((l) => ({ itemId: sku(l.sku), qty: String(l.qty), purpose: l.note, wbsNodeId: l.wbs ? wbsId(l.wbs) : undefined, costCodeId: l.cc ? ccId(l.cc) : undefined })),
  });
}

async function stockFlows(): Promise<void> {
  section('Stock and materials: requests, issues, return, transfer, adjustment, count');
  if ((await list('/material-requests', 'DEMO')).length) {
    log('stock demo documents already exist - skipped');
    return;
  }
  const P1 = 'PRJ-2026-001';
  const P2 = 'PRJ-2026-002';

  // Request -> approval -> issue to the project (fully issued)
  const mr1 = await materialRequest(P1, 'WH-MAIN', 'Column pour, Level 3 (cement, sand, rebar)', [
    { sku: 'CEM-001', qty: 400, wbs: 'P1:2.2', cc: 'MAT-CON' },
    { sku: 'AGG-001', qty: 25, wbs: 'P1:2.2', cc: 'MAT-CON' },
    { sku: 'STL-001', qty: 200, wbs: 'P1:2.2', cc: 'MAT-STL' },
  ]);
  await submitAndApprove('/material-requests', mr1);
  const issue1 = await post('/material-issues', { requestId: mr1.id, receivedBy: 'Liza Garcia (Site Engineer)', vehicle: 'Hilux NAB 2201', deliveryRef: 'DR-MI-0001', remarks: 'Issued for Level 3 column pour' });
  await post(`/material-issues/${issue1.id}/post`);
  const issue1Detail = await get(`/material-issues/${issue1.id}`);
  log('material request approved -> issue posted -> project cost booked');

  // Return of unused cement
  const cementLine = issue1Detail.lines.find((l: Json) => l.itemId === sku('CEM-001'));
  if (cementLine) {
    const ret = await post('/material-returns', {
      issueId: issue1.id, returnDate: at(0), reason: 'Unused cement returned after pour was postponed due to rain',
      lines: [{ issueLineId: cementLine.id, qty: '40', condition: 'GOOD' }],
    });
    await post(`/material-returns/${ret.id}/post`);
    log('40 bags of cement returned to the warehouse');
  }

  // Request approved and only partly issued
  const mr2 = await materialRequest(P1, 'WH-MAIN', 'Masonry for Level 2 partitions', [{ sku: 'CHB-001', qty: 3000, wbs: 'P1:2.3', cc: 'MAT-CON' }]);
  await submitAndApprove('/material-requests', mr2);
  const mr2Detail = await get(`/material-requests/${mr2.id}`);
  const issue2 = await post('/material-issues', {
    requestId: mr2.id, receivedBy: 'Foreman Ben Tolentino', remarks: 'First batch of blocks',
    lines: mr2Detail.lines.map((l: Json) => ({ requestLineId: l.id, qty: '1800' })),
  });
  await post(`/material-issues/${issue2.id}/post`);

  // Request for the road project
  const mr5 = await materialRequest(P2, 'WH-LAG', 'Culvert joint grout', [{ sku: 'GRT-001', qty: 12, wbs: 'P2:2.1', cc: 'MAT-CON' }]);
  await submitAndApprove('/material-requests', mr5);
  const issue5 = await post('/material-issues', { requestId: mr5.id, receivedBy: 'Culvert crew foreman', remarks: 'Culvert joint sealing' });
  await post(`/material-issues/${issue5.id}/post`);

  // Direct issues (no request): cement to the road project, and one serialized power tool
  const direct = await post('/material-issues', {
    projectId: ctx.projects[P2].id, warehouseId: ctx.warehouses['WH-MAIN'].id, receivedBy: 'Laguna site store',
    remarks: 'Urgent cement for base course trial section',
    lines: [{ itemId: sku('CEM-001'), qty: '100', wbsNodeId: wbsId('P2:1.2'), costCodeId: ccId('MAT-CON') }],
  });
  await post(`/material-issues/${direct.id}/post`);
  const tool = await post('/material-issues', {
    projectId: ctx.projects[P2].id, warehouseId: ctx.warehouses['WH-LAG'].id, receivedBy: 'Culvert crew foreman',
    remarks: 'Rotary hammer drill assigned to culvert crew',
    lines: [{ itemId: sku('TLS-001'), qty: '1', serialNos: ['RHD-24-0001'], costCodeId: ccId('EQP-RNT') }],
  });
  await post(`/material-issues/${tool.id}/post`);
  log('request-based and direct issues posted (including a serialized tool)');

  // Requests waiting / draft
  const mr3 = await materialRequest(P1, 'WH-MAIN', 'Rebar for Level 4 columns', [{ sku: 'STL-002', qty: 100, wbs: 'P1:2.2', cc: 'MAT-STL' }]);
  await post(`/material-requests/${mr3.id}/submit`);
  await materialRequest(P1, 'WH-MAIN', 'Blocks for stair core walls', [{ sku: 'CHB-001', qty: 800, wbs: 'P1:2.3', cc: 'MAT-CON' }]);
  log('one request awaiting approval, one still a draft');

  // Warehouse transfer: main warehouse -> tower site store
  const transfer = await post('/warehouse-transfers', {
    fromWarehouseId: ctx.warehouses['WH-MAIN'].id, toWarehouseId: ctx.warehouses['WH-MTA'].id, transferDate: at(0),
    remarks: 'Stock moved to the tower site store for Level 3 works',
    lines: [{ itemId: sku('CHB-001'), qty: '1000' }, { itemId: sku('CEM-001'), qty: '100' }],
  });
  const submitted = await post(`/warehouse-transfers/${transfer.id}/submit`);
  if (submitted.status !== 'APPROVED') await approveFully(`/warehouse-transfers/${transfer.id}`, ['APPROVED']);
  await post(`/warehouse-transfers/${transfer.id}/post`);
  log('transfer posted between warehouses');

  // Stock adjustment (posted) and one waiting for approval
  const adj = await post('/stock-adjustments', {
    warehouseId: ctx.warehouses['WH-MAIN'].id, adjustDate: at(0), reason: 'Bags damaged by rain during storage',
    lines: [{ itemId: sku('CEM-001'), qtyDelta: '-12' }],
  });
  await submitAndApprove('/stock-adjustments', adj);
  await post(`/stock-adjustments/${adj.id}/post`);
  const adj2 = await post('/stock-adjustments', {
    warehouseId: ctx.warehouses['WH-MAIN'].id, adjustDate: at(0), reason: 'Sand pile shrinkage found during yard walk',
    lines: [{ itemId: sku('AGG-001'), qtyDelta: '-2' }],
  });
  await post(`/stock-adjustments/${adj2.id}/submit`);
  log('stock adjustment posted, another awaiting approval');

  // Stock count with a small variance, posted
  const count = await post('/stock-counts', { warehouseId: ctx.warehouses['WH-MAIN'].id, countDate: at(0), remarks: 'DEMO - monthly cycle count', itemIds: [sku('CEM-001'), sku('AGG-002')] });
  const countDetail = await get(`/stock-counts/${count.id}`);
  await put(`/stock-counts/${count.id}/lines`, {
    lines: countDetail.lines.map((l: Json) => ({ lineId: l.id, physicalQty: String(Math.max(0, Number(l.systemQty ?? l.expectedQty ?? 0) - (l.itemId === sku('AGG-002') ? 1 : 0))), reason: l.itemId === sku('AGG-002') ? 'Counted 1 m3 short' : undefined })),
  });
  await submitAndApprove('/stock-counts', count);
  await post(`/stock-counts/${count.id}/post`);
  log('cycle count posted with a variance');
}

async function periods(): Promise<void> {
  section('Accounting periods');
  const year = new Date().getFullYear();
  const all = rows(await get(`/accounting/periods?year=${year}`)).sort((a, b) => a.month - b.month);
  const month = new Date().getMonth() + 1;
  for (const p of all) {
    if (p.month <= Math.min(7, month - 2) && !p.closed) await post(`/accounting/periods/${p.id}/close`, { reason: 'Month-end close - demo' });
  }
  log(`months before this quarter closed; current period stays open (${year})`);
}

// ---------------------------------------------------------------------------------------------------
async function main(): Promise<void> {
  console.log(`Seeding demo data through ${API} as ${EMAIL}`);
  await login();
  await loadBase();
  await organization();
  await warehouses();
  await users();
  await parties();
  await catalog();
  await loadBase();
  await projectSetup();
  await procurementFlows();
  await stockFlows();
  await periods();
  console.log('\nDone.');
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
