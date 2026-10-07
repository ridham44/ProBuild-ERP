import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { login, startApp, stopApp, TestContext } from './support/app';
import { createCompany, createUser, TEST_PASSWORD, TestCompany } from './support/fixtures';

describe('Auth', () => {
  let ctx: TestContext;
  let company: TestCompany;

  beforeAll(async () => {
    ctx = await startApp();
    company = await createCompany(ctx.prisma, 'Auth');
  });
  afterAll(() => stopApp(ctx));

  it('rejects protected routes without a session (401 problem details)', async () => {
    const res = await ctx.http().get('/v1/company');
    expect(res.status).toBe(401);
    expect(res.headers['content-type']).toContain('application/problem+json');
    expect(res.body).toMatchObject({ status: 401, title: expect.any(String) });
  });

  it('logs in, sets an httpOnly cookie and returns the session user without secrets', async () => {
    const user = await createUser(ctx.prisma, company, { roles: ['Company Admin'] });
    const res = await ctx.http().post('/v1/auth/login').send({ email: user.email, password: TEST_PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.email).toBe(user.email);
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|tokenHash/);
    const cookie = (res.headers['set-cookie'] as unknown as string[]).join(';');
    expect(cookie).toMatch(/pb_session=/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
  });

  it('uses the same generic failure for unknown email and wrong password', async () => {
    const user = await createUser(ctx.prisma, company);
    const wrongPassword = await ctx.http().post('/v1/auth/login').send({ email: user.email, password: 'nope-nope-nope' });
    const unknownEmail = await ctx.http().post('/v1/auth/login').send({ email: 'ghost@test.local', password: 'nope-nope-nope' });
    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(wrongPassword.body.detail).toBe(unknownEmail.body.detail);
  });

  it('returns field-level validation errors for malformed login input', async () => {
    const res = await ctx.http().post('/v1/auth/login').send({ email: 'not-an-email' });
    expect(res.status).toBe(400);
    expect(res.body.errors).toEqual(expect.arrayContaining([expect.objectContaining({ path: 'email' })]));
  });

  it('locks the account after repeated failures, even for the correct password, and audits it', async () => {
    const user = await createUser(ctx.prisma, company);
    for (let i = 0; i < 5; i++) {
      await ctx.http().post('/v1/auth/login').send({ email: user.email, password: 'wrong-password-1' });
    }
    const blocked = await ctx.http().post('/v1/auth/login').send({ email: user.email, password: TEST_PASSWORD });
    expect(blocked.status).toBe(401);
    const audit = await ctx.prisma.auditLog.findMany({ where: { userId: user.id, action: 'LOGIN_BLOCKED_LOCKED' } });
    expect(audit.length).toBeGreaterThan(0);
  });

  it('forces a password change before anything else, then revokes other sessions', async () => {
    const user = await createUser(ctx.prisma, company, { roles: ['Company Admin'], mustChangePassword: true });
    const agent = await login(ctx, user.email, TEST_PASSWORD);
    const other = await login(ctx, user.email, TEST_PASSWORD);

    expect((await agent.get('/v1/company')).status).toBe(403);
    expect((await agent.get('/v1/auth/me')).status).toBe(200);

    const weak = await agent.post('/v1/auth/password').send({ currentPassword: TEST_PASSWORD, newPassword: 'short' });
    expect(weak.status).toBe(400);

    const changed = await agent.post('/v1/auth/password').send({ currentPassword: TEST_PASSWORD, newPassword: 'Brand-New-Passw0rd' });
    expect(changed.status).toBe(204);

    expect((await agent.get('/v1/company')).status).toBe(200);
    expect((await other.get('/v1/auth/me')).status).toBe(401);
    expect((await ctx.http().post('/v1/auth/login').send({ email: user.email, password: TEST_PASSWORD })).status).toBe(401);
  });

  it('rejects a wrong current password on change', async () => {
    const user = await createUser(ctx.prisma, company);
    const agent = await login(ctx, user.email, TEST_PASSWORD);
    const res = await agent.post('/v1/auth/password').send({ currentPassword: 'wrong-password-1', newPassword: 'Brand-New-Passw0rd' });
    expect(res.status).toBe(422);
  });

  it('completes an admin-issued reset exactly once and revokes existing sessions', async () => {
    const admin = await createUser(ctx.prisma, company, { roles: ['Company Admin'] });
    const target = await createUser(ctx.prisma, company);
    const adminAgent = await login(ctx, admin.email, TEST_PASSWORD);
    const targetAgent = await login(ctx, target.email, TEST_PASSWORD);

    const issued = await adminAgent.post(`/v1/users/${target.id}/password-reset`);
    expect(issued.status).toBe(201);
    const token = issued.body.token as string;

    const done = await ctx.http().post('/v1/auth/password-reset/confirm').send({ token, newPassword: 'Reset-Passw0rd-OK' });
    expect(done.status).toBe(204);
    const replay = await ctx.http().post('/v1/auth/password-reset/confirm').send({ token, newPassword: 'Another-Passw0rd-1' });
    expect(replay.status).toBe(422);

    expect((await targetAgent.get('/v1/auth/me')).status).toBe(401);
    expect((await ctx.http().post('/v1/auth/login').send({ email: target.email, password: 'Reset-Passw0rd-OK' })).status).toBe(200);
  });

  it('cannot issue a reset for a user in another company', async () => {
    const other = await createCompany(ctx.prisma, 'Other');
    const foreign = await createUser(ctx.prisma, other);
    const admin = await createUser(ctx.prisma, company, { roles: ['Company Admin'] });
    const agent = await login(ctx, admin.email, TEST_PASSWORD);
    expect((await agent.post(`/v1/users/${foreign.id}/password-reset`)).status).toBe(404);
  });

  it('lists and revokes own sessions only', async () => {
    const user = await createUser(ctx.prisma, company);
    const victim = await createUser(ctx.prisma, company);
    const agent = await login(ctx, user.email, TEST_PASSWORD);
    await login(ctx, victim.email, TEST_PASSWORD);

    const list = await agent.get('/v1/auth/sessions');
    expect(list.status).toBe(200);
    expect(list.body.some((s: { current: boolean }) => s.current)).toBe(true);

    const victimSession = await ctx.prisma.session.findFirstOrThrow({ where: { userId: victim.id } });
    expect((await agent.delete(`/v1/auth/sessions/${victimSession.id}`)).status).toBe(404);
  });

  it('logs out and the cookie stops working', async () => {
    const user = await createUser(ctx.prisma, company);
    const agent = await login(ctx, user.email, TEST_PASSWORD);
    expect((await agent.post('/v1/auth/logout')).status).toBe(204);
    expect((await agent.get('/v1/auth/me')).status).toBe(401);
  });

  it('blocks cross-site state-changing requests', async () => {
    const res = await request(ctx.app.getHttpServer())
      .post('/v1/auth/login')
      .set('Origin', 'https://evil.example')
      .send({ email: 'x@test.local', password: 'whatever-1' });
    expect(res.status).toBe(403);
  });
});
