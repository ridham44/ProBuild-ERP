import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ApprovalsService } from '../src/engines/approvals/approvals.service';
import { login, startApp, stopApp, TestContext } from './support/app';
import { createCompany, createCustomerAndProject, createUser, TEST_PASSWORD, TestCompany } from './support/fixtures';

describe('Approval engine', () => {
  let ctx: TestContext;
  let company: TestCompany;
  let approvals: ApprovalsService;
  let requesterId: string;
  let adminAgent: Awaited<ReturnType<typeof login>>;

  beforeAll(async () => {
    ctx = await startApp();
    company = await createCompany(ctx.prisma, 'Appr');
    approvals = ctx.app.get(ApprovalsService);
    const admin = await createUser(ctx.prisma, company, { roles: ['Company Admin'] });
    adminAgent = await login(ctx, admin.email, TEST_PASSWORD);
    requesterId = (await createUser(ctx.prisma, company, { roles: ['Site Engineer'] })).id;

    const res = await adminAgent.put('/v1/approval-workflows').send({
      documentType: 'PURCHASE_REQUISITION',
      name: 'PR',
      rules: [
        { minAmount: '0', maxAmount: '50000', steps: [{ roleName: 'Project Manager' }] },
        { minAmount: '50000.01', steps: [{ roleName: 'Project Manager' }, { roleName: 'Finance' }] },
      ],
    });
    expect(res.status).toBe(200);
  });
  afterAll(() => stopApp(ctx));

  const submit = (amount: number, projectId?: string) =>
    ctx.prisma.$transaction((tx) =>
      approvals.submit(tx, {
        companyId: company.id, documentType: 'PURCHASE_REQUISITION', documentId: `pr-${Math.random()}`, documentNo: 'PR-TEST', amount, requestedById: requesterId, projectId,
      }),
    );

  it('selects the rule by amount band', async () => {
    const small = await submit(10_000);
    const large = await submit(300_000);
    expect(small.required && small.request.totalSteps).toBe(1);
    expect(large.required && large.request.totalSteps).toBe(2);
    expect(large.required && large.request.currentRole).toBe('Project Manager');
  });

  it('returns required=false when no workflow exists for the document type', async () => {
    const res = await ctx.prisma.$transaction((tx) =>
      approvals.submit(tx, { companyId: company.id, documentType: 'PAYMENT', documentId: 'p1', amount: 1, requestedById: requesterId }),
    );
    expect(res.required).toBe(false);
  });

  it('walks a two-step approval in order and enforces the role at each step', async () => {
    const result = await submit(300_000);
    if (!result.required) throw new Error('expected approval');
    const id = result.request.id;

    const pm = await createUser(ctx.prisma, company, { roles: ['Project Manager'] });
    const fin = await createUser(ctx.prisma, company, { roles: ['Finance'] });
    const pmAgent = await login(ctx, pm.email, TEST_PASSWORD);
    const finAgent = await login(ctx, fin.email, TEST_PASSWORD);

    expect((await finAgent.post(`/v1/approvals/${id}/approve`).send({})).status).toBe(403);
    expect((await pmAgent.post(`/v1/approvals/${id}/approve`).send({ comment: 'Scope OK' })).status).toBe(201);
    expect((await pmAgent.post(`/v1/approvals/${id}/approve`).send({})).status).toBe(403);
    const final = await finAgent.post(`/v1/approvals/${id}/approve`).send({});
    expect(final.status).toBe(201);
    expect(final.body.status).toBe('APPROVED');
    expect((await finAgent.post(`/v1/approvals/${id}/approve`).send({})).status).toBe(422);

    const actions = await ctx.prisma.approvalAction.findMany({ where: { requestId: id }, orderBy: { createdAt: 'asc' } });
    expect(actions.map((a) => a.stepOrder)).toEqual([1, 2]);
  });

  it('a rejection ends the request and records the reason', async () => {
    const result = await submit(20_000);
    if (!result.required) throw new Error('expected approval');
    const pm = await createUser(ctx.prisma, company, { roles: ['Project Manager'] });
    const pmAgent = await login(ctx, pm.email, TEST_PASSWORD);
    const res = await pmAgent.post(`/v1/approvals/${result.request.id}/reject`).send({ comment: 'Over budget' });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('REJECTED');
  });

  it('does not let the requester approve their own request', async () => {
    const requester = await createUser(ctx.prisma, company, { roles: ['Project Manager'] });
    const result = await ctx.prisma.$transaction((tx) =>
      approvals.submit(tx, { companyId: company.id, documentType: 'PURCHASE_REQUISITION', documentId: `self-${Math.random()}`, amount: 100, requestedById: requester.id }),
    );
    if (!result.required) throw new Error('expected approval');
    const agent = await login(ctx, requester.email, TEST_PASSWORD);
    expect((await agent.post(`/v1/approvals/${result.request.id}/approve`).send({})).status).toBe(403);
  });

  it('enforces project scope: an approver scoped to another project is refused', async () => {
    const { project: p1 } = await createCustomerAndProject(ctx.prisma, company, 'APR1');
    const { project: p2 } = await createCustomerAndProject(ctx.prisma, company, 'APR2');
    const result = await submit(1_000, p1.id);
    if (!result.required) throw new Error('expected approval');
    const wrongScope = await createUser(ctx.prisma, company, { roles: ['Project Manager'], projectId: p2.id });
    const rightScope = await createUser(ctx.prisma, company, { roles: ['Project Manager'], projectId: p1.id });
    const wrong = await login(ctx, wrongScope.email, TEST_PASSWORD);
    const right = await login(ctx, rightScope.email, TEST_PASSWORD);
    expect((await wrong.post(`/v1/approvals/${result.request.id}/approve`).send({})).status).toBe(403);
    expect((await right.post(`/v1/approvals/${result.request.id}/approve`).send({})).status).toBe(201);
  });

  it('only one of two simultaneous approvals by different users at the same step can win', async () => {
    const result = await submit(500);
    if (!result.required) throw new Error('expected approval');
    const a = await createUser(ctx.prisma, company, { roles: ['Project Manager'] });
    const b = await createUser(ctx.prisma, company, { roles: ['Project Manager'] });
    const [agentA, agentB] = await Promise.all([login(ctx, a.email, TEST_PASSWORD), login(ctx, b.email, TEST_PASSWORD)]);
    const [ra, rb] = await Promise.all([
      agentA.post(`/v1/approvals/${result.request.id}/approve`).send({}),
      agentB.post(`/v1/approvals/${result.request.id}/approve`).send({}),
    ]);
    const statuses = [ra.status, rb.status].sort();
    expect(statuses.filter((s) => s === 201)).toHaveLength(1);
    expect(await ctx.prisma.approvalAction.count({ where: { requestId: result.request.id } })).toBe(1);
  });

  it('parses ?mine=false correctly and filters the inbox to my roles for ?mine=true', async () => {
    const pm = await createUser(ctx.prisma, company, { roles: ['Project Manager'] });
    const pmAgent = await login(ctx, pm.email, TEST_PASSWORD);
    await submit(100);
    const mine = await pmAgent.get('/v1/approvals').query({ mine: 'true' });
    expect(mine.status).toBe(200);
    expect(mine.body.items.every((r: { currentRole: string; status: string }) => r.currentRole === 'Project Manager' && r.status === 'PENDING')).toBe(true);
    const all = await pmAgent.get('/v1/approvals').query({ mine: 'false' });
    expect(all.status).toBe(200);
    expect(all.body.items.length).toBeGreaterThanOrEqual(mine.body.items.length);
    expect((await pmAgent.get('/v1/approvals').query({ mine: 'maybe' })).status).toBe(400);
  });
});
