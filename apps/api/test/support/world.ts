import type { ApprovalDocumentType } from '@probuild/shared';
import type TestAgent from 'supertest/lib/agent';
import { login, TestContext } from './app';
import { createCompany, createCustomerAndProject, createUser, createWarehouse, TEST_PASSWORD, TestCompany } from './fixtures';

export type Agent = TestAgent;

/** A company with one agent per role the procurement stages care about, plus a project and a warehouse. */
export type World = {
  ctx: TestContext;
  company: TestCompany;
  admin: Agent;
  pm: Agent;
  engineer: Agent;
  buyer: Agent;
  finance: Agent;
  viewer: Agent;
  users: { admin: string; pm: string; engineer: string; buyer: string; finance: string; viewer: string };
  customerId: string;
  project: { id: string; code: string };
  otherProject: { id: string; code: string };
  warehouse: { id: string; code: string };
};

let counter = 0;
export const uniq = (prefix: string): string => `${prefix}-${Date.now().toString(36)}${(counter++).toString(36)}`;

export async function buildWorld(ctx: TestContext, label: string): Promise<World> {
  const company = await createCompany(ctx.prisma, label);
  const make = async (roles: string[]) => {
    const user = await createUser(ctx.prisma, company, { roles });
    return { id: user.id, agent: await login(ctx, user.email, TEST_PASSWORD) };
  };
  // Sequential on purpose: parallel argon2 + session transactions can exhaust the connection pool on busy machines.
  const admin = await make(['Company Admin']);
  const pm = await make(['Project Manager']);
  const engineer = await make(['Project Engineer']);
  const buyer = await make(['Procurement']);
  const finance = await make(['Finance']);
  const viewer = await make(['Foreman']);
  const { customer, project } = await createCustomerAndProject(ctx.prisma, company, uniq('P'));
  const { project: otherProject } = await createCustomerAndProject(ctx.prisma, company, uniq('Q'));
  const warehouse = await createWarehouse(ctx.prisma, company, uniq('WH'));
  return {
    ctx,
    company,
    admin: admin.agent,
    pm: pm.agent,
    engineer: engineer.agent,
    buyer: buyer.agent,
    finance: finance.agent,
    viewer: viewer.agent,
    users: { admin: admin.id, pm: pm.id, engineer: engineer.id, buyer: buyer.id, finance: finance.id, viewer: viewer.id },
    customerId: customer.id,
    project: { id: project.id, code: project.code },
    otherProject: { id: otherProject.id, code: otherProject.code },
    warehouse: { id: warehouse.id, code: warehouse.code },
  };
}

/** Logs in a fresh user with the given roles, optionally restricted to one project or warehouse. */
export async function userAgent(
  w: World,
  roles: string[],
  scope: { projectId?: string; warehouseId?: string } = {},
): Promise<{ id: string; agent: Agent }> {
  const user = await createUser(w.ctx.prisma, w.company, { roles, ...scope });
  return { id: user.id, agent: await login(w.ctx, user.email, TEST_PASSWORD) };
}

export async function setWorkflow(
  admin: Agent,
  documentType: ApprovalDocumentType,
  rules: Array<{ minAmount: string; maxAmount?: string; steps: string[] }>,
): Promise<void> {
  const res = await admin.put('/v1/approval-workflows').send({
    documentType,
    name: documentType,
    rules: rules.map((r) => ({ minAmount: r.minAmount, maxAmount: r.maxAmount, steps: r.steps.map((roleName) => ({ roleName })) })),
  });
  if (res.status !== 200) throw new Error(`Workflow setup failed: ${res.status} ${JSON.stringify(res.body)}`);
}

let keyCounter = 0;
/** A fresh, valid Idempotency-Key. */
export const idemKey = (label = 'k'): string => `${label}-${Date.now().toString(36)}-${(keyCounter++).toString(36)}-xx`;

export async function expectOk<T = Record<string, unknown>>(res: { status: number; body: unknown }, ...codes: number[]): Promise<T> {
  const allowed = codes.length > 0 ? codes : [200, 201];
  if (!allowed.includes(res.status)) throw new Error(`Expected ${allowed.join('/')} but got ${res.status}: ${JSON.stringify(res.body)}`);
  return res.body as T;
}

type Page<T> = { items: T[]; nextCursor: string | null };
export type Json = Record<string, unknown> & { id: string };

export const createSupplier = async (agent: Agent, code = uniq('SUP'), extra: Record<string, unknown> = {}): Promise<Json> =>
  expectOk<Json>(await agent.post('/v1/suppliers').send({ code, name: `Supplier ${code}`, ...extra }));

export const createItem = async (agent: Agent, sku = uniq('ITM'), extra: Record<string, unknown> = {}): Promise<Json> =>
  expectOk<Json>(await agent.post('/v1/items').send({ sku, name: `Item ${sku}`, baseUnit: 'pc', ...extra }));

export async function listAll<T>(agent: Agent, path: string): Promise<T[]> {
  const out: T[] = [];
  let cursor: string | null = null;
  for (let i = 0; i < 50; i++) {
    const res: { status: number; body: unknown } = await agent.get(path).query({ limit: 100, ...(cursor ? { cursor } : {}) });
    const body = await expectOk<Page<T>>(res, 200);
    out.push(...body.items);
    cursor = body.nextCursor;
    if (!cursor) break;
  }
  return out;
}
