import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { login, startApp, stopApp, TestContext } from './support/app';
import { createCompany, createCustomerAndProject, createItem, createUser, createWarehouse, TEST_PASSWORD, TestCompany } from './support/fixtures';

describe('Tenant isolation', () => {
  let ctx: TestContext;
  let a: TestCompany;
  let b: TestCompany;

  beforeAll(async () => {
    ctx = await startApp();
    a = await createCompany(ctx.prisma, 'TenantA');
    b = await createCompany(ctx.prisma, 'TenantB');
  });
  afterAll(() => stopApp(ctx));

  it('does not list another company\'s warehouses', async () => {
    await createWarehouse(ctx.prisma, a, 'A-MAIN');
    await createWarehouse(ctx.prisma, b, 'B-MAIN');
    const userA = await createUser(ctx.prisma, a, { roles: ['Company Admin'] });
    const agent = await login(ctx, userA.email, TEST_PASSWORD);
    const res = await agent.get('/v1/warehouses');
    expect(res.status).toBe(200);
    const codes = res.body.items.map((w: { code: string }) => w.code);
    expect(codes).toContain('A-MAIN');
    expect(codes).not.toContain('B-MAIN');
  });

  it('cannot read or modify another company\'s record by id (404, not 403)', async () => {
    const foreign = await createWarehouse(ctx.prisma, b, 'B-SECRET');
    const userA = await createUser(ctx.prisma, a, { roles: ['Company Admin'] });
    const agent = await login(ctx, userA.email, TEST_PASSWORD);
    const res = await agent.patch(`/v1/warehouses/${foreign.id}`).send({ name: 'Hijacked' });
    expect(res.status).toBe(404);
    const stored = await ctx.prisma.warehouse.findUniqueOrThrow({ where: { id: foreign.id } });
    expect(stored.name).not.toBe('Hijacked');
  });

  it('rejects a warehouse that points at another company\'s project (relation injection)', async () => {
    const { project: foreignProject } = await createCustomerAndProject(ctx.prisma, b, 'FOREIGN');
    const userA = await createUser(ctx.prisma, a, { roles: ['Company Admin'] });
    const agent = await login(ctx, userA.email, TEST_PASSWORD);
    const res = await agent.post('/v1/warehouses').send({ code: 'INJECT', name: 'Injected', type: 'SITE', projectId: foreignProject.id });
    expect(res.status).toBe(422);
  });

  it('database refuses stock ledger rows that reference another company\'s master data', async () => {
    const whA = await createWarehouse(ctx.prisma, a, 'A-LEDGER');
    const itemB = await createItem(ctx.prisma, b, 'B-ONLY');
    await expect(
      ctx.prisma.stockLedger.create({
        data: {
          companyId: a.id, txnNo: 'X-1', txnDate: new Date(), txnType: 'OPENING', warehouseId: whA.id, itemId: itemB.id,
          qty: 1, unitCost: 1, value: 1, runningQty: 1, runningValue: 1, sourceType: 'T', sourceId: 'x', userId: 'u',
        },
      }),
    ).rejects.toThrow(/Cross-company reference: item/);
  });

  it('database refuses project cost rows for another company\'s project', async () => {
    const { project: projectB } = await createCustomerAndProject(ctx.prisma, b, 'COSTB');
    await expect(
      ctx.prisma.projectCostLedger.create({
        data: {
          companyId: a.id, projectId: projectB.id, costCategory: 'MATERIAL', txnType: 'MATERIAL_ISSUE', txnDate: new Date(),
          totalCost: 100, sourceType: 'T', sourceId: 'x', userId: 'u',
        },
      }),
    ).rejects.toThrow(/Cross-company reference: project/);
  });

  it('database refuses journal lines on another company\'s account', async () => {
    const foreignAccount = await ctx.prisma.account.findFirstOrThrow({ where: { companyId: b.id, code: '1000' } });
    const own = await ctx.prisma.account.findFirstOrThrow({ where: { companyId: a.id, code: '1010' } });
    await expect(
      ctx.prisma.journalEntry.create({
        data: {
          companyId: a.id, entryNo: `JE-X-${Date.now()}`, entryDate: new Date(), description: 'bad', postedById: 'u',
          lines: { create: [{ accountId: foreignAccount.id, debit: 10 }, { accountId: own.id, credit: 10 }] },
        },
      }),
    ).rejects.toThrow(/Cross-company reference: account/);
  });

  it('approval inbox only shows the caller\'s company', async () => {
    const requesterB = await createUser(ctx.prisma, b);
    await ctx.prisma.approvalRequest.create({
      data: {
        companyId: b.id, documentType: 'PURCHASE_ORDER', documentId: 'doc-b', amount: 10, stepRoles: ['Finance'], currentRole: 'Finance',
        totalSteps: 1, requestedById: requesterB.id,
      },
    });
    const userA = await createUser(ctx.prisma, a, { roles: ['Company Admin'] });
    const agent = await login(ctx, userA.email, TEST_PASSWORD);
    const res = await agent.get('/v1/approvals');
    expect(res.status).toBe(200);
    expect(res.body.items.every((r: { companyId: string }) => r.companyId === a.id)).toBe(true);
  });
});
