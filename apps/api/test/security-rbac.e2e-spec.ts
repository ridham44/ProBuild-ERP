import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { login, startApp, stopApp, TestContext } from './support/app';
import { createCompany, createCustomerAndProject, createUser, TEST_PASSWORD, TestCompany } from './support/fixtures';

describe('RBAC and privilege escalation', () => {
  let ctx: TestContext;
  let company: TestCompany;
  let userAdminRoleId: string;

  beforeAll(async () => {
    ctx = await startApp();
    company = await createCompany(ctx.prisma, 'Rbac');
    // A delegated administrator who can manage users and roles but holds no finance authority.
    const role = await ctx.prisma.role.create({ data: { companyId: company.id, name: 'User Manager' } });
    await ctx.prisma.rolePermission.createMany({
      data: (['VIEW', 'CREATE', 'EDIT'] as const).flatMap((action) => [
        { roleId: role.id, module: 'security.user', action },
        { roleId: role.id, module: 'security.role', action },
      ]),
    });
    userAdminRoleId = role.id;
    company.roleIds.set('User Manager', role.id);
  });
  afterAll(() => stopApp(ctx));

  it('forbids a route when the user lacks the permission (403)', async () => {
    const user = await createUser(ctx.prisma, company, { roles: ['Foreman'] });
    const agent = await login(ctx, user.email, TEST_PASSWORD);
    expect((await agent.get('/v1/users')).status).toBe(403);
  });

  it('prevents assigning a role that holds more authority than the assigner', async () => {
    const manager = await createUser(ctx.prisma, company, { roles: ['User Manager'] });
    const target = await createUser(ctx.prisma, company);
    const agent = await login(ctx, manager.email, TEST_PASSWORD);

    const finance = company.roleIds.get('Finance');
    const res = await agent.post(`/v1/users/${target.id}/roles`).send({ roleId: finance });
    expect(res.status).toBe(403);
    expect(await ctx.prisma.userRoleAssignment.count({ where: { userId: target.id } })).toBe(0);
  });

  it('prevents granting oneself administrator rights through role assignment', async () => {
    const manager = await createUser(ctx.prisma, company, { roles: ['User Manager'] });
    const agent = await login(ctx, manager.email, TEST_PASSWORD);
    const admin = company.roleIds.get('Company Admin');
    const res = await agent.post(`/v1/users/${manager.id}/roles`).send({ roleId: admin });
    expect(res.status).toBe(403);
  });

  it('prevents editing a role to add permissions the editor does not hold', async () => {
    const manager = await createUser(ctx.prisma, company, { roles: ['User Manager'] });
    const agent = await login(ctx, manager.email, TEST_PASSWORD);
    const res = await agent
      .put(`/v1/roles/${userAdminRoleId}/permissions`)
      .send({ permissions: [{ module: 'security.user', action: 'EDIT' }, { module: 'finance.payment', action: 'APPROVE' }] });
    expect(res.status).toBe(403);
    const stored = await ctx.prisma.rolePermission.count({ where: { roleId: userAdminRoleId, module: 'finance.payment' } });
    expect(stored).toBe(0);
  });

  it('allows narrowing a role the editor fully holds', async () => {
    const manager = await createUser(ctx.prisma, company, { roles: ['User Manager'] });
    const agent = await login(ctx, manager.email, TEST_PASSWORD);
    const custom = await ctx.prisma.role.create({ data: { companyId: company.id, name: `Viewer-${Date.now()}` } });
    const res = await agent.put(`/v1/roles/${custom.id}/permissions`).send({ permissions: [{ module: 'security.user', action: 'VIEW' }] });
    expect(res.status).toBe(200);
  });

  it('cannot assign roles from another company', async () => {
    const other = await createCompany(ctx.prisma, 'Foreign');
    const manager = await createUser(ctx.prisma, company, { roles: ['User Manager'] });
    const target = await createUser(ctx.prisma, company);
    const agent = await login(ctx, manager.email, TEST_PASSWORD);
    const res = await agent.post(`/v1/users/${target.id}/roles`).send({ roleId: other.roleIds.get('Foreman') });
    expect(res.status).toBe(404);
  });

  it('a project-scoped grant cannot be handed out company-wide', async () => {
    const { project } = await createCustomerAndProject(ctx.prisma, company, 'SCOPE1');
    const scoped = await createUser(ctx.prisma, company, { roles: ['User Manager'], projectId: project.id });
    const target = await createUser(ctx.prisma, company);
    const agent = await login(ctx, scoped.email, TEST_PASSWORD);

    const companyWide = await agent.post(`/v1/users/${target.id}/roles`).send({ roleId: company.roleIds.get('Foreman') });
    expect(companyWide.status).toBe(403);
  });

  it('new users must change their password and password policy is enforced on creation', async () => {
    const manager = await createUser(ctx.prisma, company, { roles: ['User Manager'] });
    const agent = await login(ctx, manager.email, TEST_PASSWORD);
    const weak = await agent.post('/v1/users').send({ email: 'weak@test.local', name: 'Weak', password: 'abc' });
    expect(weak.status).toBe(400);

    const ok = await agent.post('/v1/users').send({ email: `new-${Date.now()}@test.local`, name: 'New Hire', password: 'Initial-Passw0rd-1' });
    expect(ok.status).toBe(201);
    const stored = await ctx.prisma.user.findUniqueOrThrow({ where: { id: ok.body.id } });
    expect(stored.mustChangePassword).toBe(true);
  });
});
