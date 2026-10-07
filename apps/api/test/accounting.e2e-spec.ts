import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { login, startApp, stopApp, TestContext } from './support/app';
import { createCompany, createUser, TEST_PASSWORD, TestCompany } from './support/fixtures';

describe('Accounting and idempotency', () => {
  let ctx: TestContext;
  let company: TestCompany;
  let agent: Awaited<ReturnType<typeof login>>;
  let cashId: string;
  let revenueId: string;

  const journalBody = (entryDate: string, amount = '1000.00') => ({
    entryDate,
    description: 'Mobilization advance received',
    lines: [
      { accountId: cashId, debit: amount, credit: '0' },
      { accountId: revenueId, debit: '0', credit: amount },
    ],
  });
  const key = () => `key-${Math.random().toString(36).slice(2)}-${Date.now()}`;

  beforeAll(async () => {
    ctx = await startApp();
    company = await createCompany(ctx.prisma, 'Acct');
    const user = await createUser(ctx.prisma, company, { roles: ['Finance'] });
    agent = await login(ctx, user.email, TEST_PASSWORD);
    cashId = (await ctx.prisma.account.findFirstOrThrow({ where: { companyId: company.id, code: '1010' } })).id;
    revenueId = (await ctx.prisma.account.findFirstOrThrow({ where: { companyId: company.id, code: '4000' } })).id;
  });
  afterAll(() => stopApp(ctx));

  it('posts a balanced journal and shows it in the trial balance', async () => {
    const res = await agent.post('/v1/accounting/journals').set('Idempotency-Key', key()).send(journalBody('2026-02-10T04:00:00Z'));
    expect(res.status).toBe(201);
    expect(res.body.entryNo).toMatch(/^JE-2026-\d{5}$/);
    expect(res.body.lines).toHaveLength(2);

    const tb = await agent.get('/v1/accounting/trial-balance').query({ to: '2026-12-31T00:00:00Z' });
    expect(tb.status).toBe(200);
    expect(tb.body.balanced).toBe(true);
    expect(tb.body.totalDebit).toBe(tb.body.totalCredit);
  });

  it('rejects an unbalanced entry with a business-rule error', async () => {
    const body = journalBody('2026-02-10T04:00:00Z');
    body.lines[1] = { accountId: revenueId, debit: '0', credit: '900.00' };
    const res = await agent.post('/v1/accounting/journals').set('Idempotency-Key', key()).send(body);
    expect(res.status).toBe(422);
    expect(res.body.detail).toMatch(/out of balance/i);
  });

  it('validates input shape (line with both debit and credit)', async () => {
    const res = await agent.post('/v1/accounting/journals').set('Idempotency-Key', key()).send({
      entryDate: '2026-02-10T04:00:00Z',
      description: 'bad',
      lines: [{ accountId: cashId, debit: '5', credit: '5' }, { accountId: revenueId, debit: '0', credit: '5' }],
    });
    expect(res.status).toBe(400);
  });

  it('requires an Idempotency-Key header', async () => {
    const res = await agent.post('/v1/accounting/journals').send(journalBody('2026-02-10T04:00:00Z'));
    expect(res.status).toBe(400);
  });

  it('replays a retried request instead of posting twice', async () => {
    const k = key();
    const body = journalBody('2026-03-05T04:00:00Z', '777.00');
    const first = await agent.post('/v1/accounting/journals').set('Idempotency-Key', k).send(body);
    const retry = await agent.post('/v1/accounting/journals').set('Idempotency-Key', k).send(body);
    expect(first.status).toBe(201);
    expect(retry.status).toBe(201);
    expect(retry.headers['idempotent-replayed']).toBe('true');
    expect(retry.body.id).toBe(first.body.id);
    expect(await ctx.prisma.journalEntry.count({ where: { companyId: company.id, description: body.description, entryDate: new Date('2026-03-05T04:00:00Z') } })).toBe(1);
  });

  it('refuses to reuse a key for a different request', async () => {
    const k = key();
    await agent.post('/v1/accounting/journals').set('Idempotency-Key', k).send(journalBody('2026-03-06T04:00:00Z', '10.00'));
    const clash = await agent.post('/v1/accounting/journals').set('Idempotency-Key', k).send(journalBody('2026-03-06T04:00:00Z', '20.00'));
    expect(clash.status).toBe(422);
  });

  it('executes only once when the same key arrives concurrently', async () => {
    const k = key();
    const body = journalBody('2026-03-07T04:00:00Z', '55.00');
    const results = await Promise.all(Array.from({ length: 6 }, () => agent.post('/v1/accounting/journals').set('Idempotency-Key', k).send(body)));
    const created = results.filter((r) => r.status === 201 && r.headers['idempotent-replayed'] !== 'true');
    expect(created).toHaveLength(1);
    expect(results.every((r) => [201, 409].includes(r.status))).toBe(true);
    expect(await ctx.prisma.journalEntry.count({ where: { companyId: company.id, entryDate: new Date('2026-03-07T04:00:00Z') } })).toBe(1);
  });

  it('assigns period and document-number year using Manila time, not UTC', async () => {
    // 2025-12-31 17:00 UTC is already 1 Jan 2026 01:00 in Manila.
    const res = await agent.post('/v1/accounting/journals').set('Idempotency-Key', key()).send(journalBody('2025-12-31T17:00:00Z', '1.00'));
    expect(res.status).toBe(201);
    expect(res.body.entryNo).toMatch(/^JE-2026-/);
    const period = await ctx.prisma.accountingPeriod.findUniqueOrThrow({ where: { id: res.body.periodId } });
    expect({ year: period.year, month: period.month }).toEqual({ year: 2026, month: 1 });
  });

  it('blocks posting into a closed period and allows it again after an override reopen', async () => {
    // A clean company so no earlier open periods exist (periods must be closed in order).
    const fresh = await createCompany(ctx.prisma, 'Close');
    const user = await createUser(ctx.prisma, fresh, { roles: ['Finance'] });
    const freshAgent = await login(ctx, user.email, TEST_PASSWORD);
    const accounts = await ctx.prisma.account.findMany({ where: { companyId: fresh.id, code: { in: ['1010', '4000'] } } });
    const cash = accounts.find((a) => a.code === '1010')!.id;
    const revenue = accounts.find((a) => a.code === '4000')!.id;
    const body = {
      entryDate: '2027-01-15T04:00:00Z',
      description: 'January billing',
      lines: [{ accountId: cash, debit: '100', credit: '0' }, { accountId: revenue, debit: '0', credit: '100' }],
    };

    const periods = await freshAgent.post('/v1/accounting/periods/years/2027');
    expect(periods.status).toBe(201);
    const jan = periods.body.find((p: { month: number }) => p.month === 1);
    const feb = periods.body.find((p: { month: number }) => p.month === 2);
    expect((await freshAgent.post(`/v1/accounting/periods/${feb.id}/close`).send({})).status).toBe(422);
    expect((await freshAgent.post(`/v1/accounting/periods/${jan.id}/close`).send({ reason: 'January close' })).status).toBe(200);

    const blocked = await freshAgent.post('/v1/accounting/journals').set('Idempotency-Key', key()).send(body);
    expect(blocked.status).toBe(422);
    expect(blocked.body.detail).toMatch(/closed/i);

    expect((await freshAgent.post(`/v1/accounting/periods/${jan.id}/reopen`).send({ reason: 'late invoice' })).status).toBe(200);
    expect((await freshAgent.post('/v1/accounting/journals').set('Idempotency-Key', key()).send(body)).status).toBe(201);
    const audited = await ctx.prisma.auditLog.findMany({ where: { companyId: fresh.id, entityType: 'AccountingPeriod' } });
    expect(audited.map((a) => a.action).sort()).toEqual(['PERIOD_CLOSED', 'PERIOD_REOPENED']);
  });

  it('reverses a journal with a mirror entry and marks the original reversed', async () => {
    const original = await agent.post('/v1/accounting/journals').set('Idempotency-Key', key()).send(journalBody('2026-04-01T04:00:00Z', '300.00'));
    const reversal = await agent.post(`/v1/accounting/journals/${original.body.id}/reverse`).set('Idempotency-Key', key()).send({ reason: 'posted to wrong project' });
    expect(reversal.status).toBe(201);
    expect(reversal.body.lines.find((l: { debit: string }) => Number(l.debit) > 0).accountId).toBe(revenueId);

    const reloaded = await agent.get(`/v1/accounting/journals/${original.body.id}`);
    expect(reloaded.body.status).toBe('REVERSED');
    const again = await agent.post(`/v1/accounting/journals/${original.body.id}/reverse`).set('Idempotency-Key', key()).send({ reason: 'twice' });
    expect(again.status).toBe(422);
  });

  it('records an audit entry for posting', async () => {
    const posts = await ctx.prisma.auditLog.count({ where: { companyId: company.id, entityType: 'JournalEntry', action: 'POST' } });
    expect(posts).toBeGreaterThan(0);
  });

  it('denies journal posting to a user without the POST permission', async () => {
    const foreman = await createUser(ctx.prisma, company, { roles: ['Foreman'] });
    const foremanAgent = await login(ctx, foreman.email, TEST_PASSWORD);
    const res = await foremanAgent.post('/v1/accounting/journals').set('Idempotency-Key', key()).send(journalBody('2026-05-01T04:00:00Z'));
    expect(res.status).toBe(403);
  });
});
