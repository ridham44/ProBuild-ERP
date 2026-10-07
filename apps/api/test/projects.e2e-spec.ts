import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CostLedgerService } from '../src/engines/cost-ledger/cost-ledger.service';
import { startApp, stopApp, TestContext } from './support/app';
import { Agent, buildWorld, expectOk, Json, uniq, userAgent, World } from './support/world';

describe('Projects, contract, WBS, cost codes and estimate/BOQ', () => {
  let ctx: TestContext;
  let w: World;
  let foreign: World;

  beforeAll(async () => {
    ctx = await startApp();
    w = await buildWorld(ctx, 'Proj');
    foreign = await buildWorld(ctx, 'ProjX');
  });
  afterAll(() => stopApp(ctx));

  const newProject = async (agent: Agent = w.admin, extra: Record<string, unknown> = {}): Promise<Json> =>
    expectOk<Json>(await agent.post('/v1/projects').send({ code: uniq('PRJ'), name: 'Two-storey school building', customerId: w.customerId, ...extra }));
  const boq = (agent: Agent, estimateId: string, itemNo: string, extra: Record<string, unknown> = {}) =>
    agent.post(`/v1/estimates/${estimateId}/items`).send({ itemNo, description: `Item ${itemNo}`, unit: 'm3', quantity: '10', unitRate: '100', ...extra });
  const activeProject = async (): Promise<Json> => {
    const p = await newProject(w.admin, { startDate: '2026-01-05', originalEndDate: '2026-12-31' });
    await expectOk(await w.admin.post(`/v1/projects/${p.id}/status`).send({ status: 'ACTIVE' }));
    return p;
  };

  describe('projects', () => {
    it('creates a project with client, branch, manager and contract data', async () => {
      const branch = await expectOk<Json>(await w.admin.post('/v1/branches').send({ code: uniq('BR'), name: 'Cebu branch' }));
      const res = await w.admin.post('/v1/projects').send({
        code: uniq('PRJ'), name: 'Mactan Warehouse Complex', customerId: w.customerId, branchId: branch.id, managerId: w.users.pm,
        type: 'INDUSTRIAL', sector: 'PRIVATE', contractAmount: '25000000.00', startDate: '2026-02-01', originalEndDate: '2026-11-30',
        retentionPct: '10', location: 'Lapu-Lapu City, Cebu',
      });
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ status: 'PIPELINE', type: 'INDUSTRIAL', contractAmount: '25000000', branchId: branch.id, managerId: w.users.pm });
      const detail = await w.admin.get(`/v1/projects/${res.body.id}`);
      expect(detail.body).toMatchObject({ customer: { id: w.customerId }, manager: { id: w.users.pm }, branch: { id: branch.id }, activeContract: null });
    });

    it('validates input and rejects references that are not in the company', async () => {
      const bad = await w.admin.post('/v1/projects').send({ code: '', name: 'x', customerId: 'nope', startDate: '2026-05-01', originalEndDate: '2026-04-01' });
      expect(bad.status).toBe(400);
      const foreignCustomer = await foreign.admin.post('/v1/customers').send({ code: uniq('FC'), name: 'Foreign' });
      const base = { code: uniq('PRJ'), name: 'Cross company' };
      const a = await w.admin.post('/v1/projects').send({ ...base, customerId: foreignCustomer.body.id });
      expect(a.status).toBe(422);
      const b = await w.admin.post('/v1/projects').send({ ...base, code: uniq('PRJ'), customerId: w.customerId, managerId: foreign.users.pm });
      expect(b.status).toBe(422);
      const dup = await newProject();
      expect((await w.admin.post('/v1/projects').send({ code: dup.code, name: 'dup', customerId: w.customerId })).status).toBe(409);
    });

    it('requires authentication and permission', async () => {
      expect((await ctx.http().get('/v1/projects')).status).toBe(401);
      expect((await w.viewer.post('/v1/projects').send({ code: uniq('X'), name: 'x', customerId: w.customerId })).status).toBe(403);
      expect((await w.viewer.get('/v1/projects')).status).toBe(200);
      const p = await newProject();
      expect((await w.viewer.patch(`/v1/projects/${p.id}`).send({ name: 'nope' })).status).toBe(403);
      expect((await w.buyer.delete(`/v1/projects/${p.id}`)).status).toBe(403);
    });

    it('is isolated by company', async () => {
      const theirs = await foreign.admin.post('/v1/projects').send({ code: uniq('FP'), name: 'Foreign project', customerId: foreign.customerId });
      expect(theirs.status).toBe(201);
      expect((await w.admin.get(`/v1/projects/${theirs.body.id}`)).status).toBe(404);
      expect((await w.admin.patch(`/v1/projects/${theirs.body.id}`).send({ name: 'x' })).status).toBe(404);
      expect((await w.admin.get(`/v1/projects/${theirs.body.id}/dashboard`)).status).toBe(404);
      expect((await w.admin.get(`/v1/projects/${theirs.body.id}/wbs`)).status).toBe(404);
      expect((await w.admin.get('/v1/projects').query({ search: theirs.body.code })).body.items).toHaveLength(0);
    });

    it('restricts a project-scoped user to their project in lists and by id', async () => {
      const mine = await newProject();
      const notMine = await newProject();
      const scoped = await userAgent(w, ['Project Manager'], { projectId: mine.id });
      const list = await scoped.agent.get('/v1/projects');
      expect(list.body.items.map((p: Json) => p.id)).toEqual([mine.id]);
      expect((await scoped.agent.get(`/v1/projects/${mine.id}`)).status).toBe(200);
      expect((await scoped.agent.get(`/v1/projects/${notMine.id}`)).status).toBe(403);
      expect((await scoped.agent.patch(`/v1/projects/${notMine.id}`).send({ name: 'x' })).status).toBe(403);
      expect((await scoped.agent.get(`/v1/projects/${notMine.id}/dashboard`)).status).toBe(403);
      expect((await scoped.agent.post(`/v1/projects/${notMine.id}/wbs`).send({ code: '1', name: 'x' })).status).toBe(403);
      expect((await scoped.agent.post('/v1/projects').send({ code: uniq('SC'), name: 'x', customerId: w.customerId })).status).toBe(403);
    });

    it('lists with filters, search, sorting and pagination', async () => {
      const tag = uniq('FLT');
      for (const n of ['1', '2', '3']) await newProject(w.admin, { code: `${tag}-${n}`, name: `${tag} project ${n}` });
      const p1 = await w.admin.get('/v1/projects').query({ search: tag, limit: 2, sort: 'code:desc' });
      expect(p1.body.items.map((p: Json) => p.code)).toEqual([`${tag}-3`, `${tag}-2`]);
      const p2 = await w.admin.get('/v1/projects').query({ search: tag, limit: 2, sort: 'code:desc', cursor: p1.body.nextCursor });
      expect(p2.body.items.map((p: Json) => p.code)).toEqual([`${tag}-1`]);
      const pipeline = await w.admin.get('/v1/projects').query({ search: tag, status: 'PIPELINE' });
      expect(pipeline.body.items).toHaveLength(3);
      expect((await w.admin.get('/v1/projects').query({ search: tag, status: 'ACTIVE' })).body.items).toHaveLength(0);
      expect((await w.admin.get('/v1/projects').query({ status: 'WRONG' })).status).toBe(400);
    });

    it('walks PIPELINE -> ACTIVE -> ON_HOLD -> ACTIVE -> COMPLETED -> CLOSED and audits each move', async () => {
      const p = await newProject(w.admin, { startDate: '2026-01-05' });
      const move = (status: string, reason?: string) => w.admin.post(`/v1/projects/${p.id}/status`).send({ status, reason });
      expect((await move('ACTIVE')).body.status).toBe('ACTIVE');
      expect((await move('ON_HOLD', 'Client payment delay')).body.status).toBe('ON_HOLD');
      expect((await move('ACTIVE')).status).toBe(200);
      expect((await move('COMPLETED')).status).toBe(200);
      expect((await move('CLOSED')).body.status).toBe('CLOSED');
      const activity = await w.admin.get(`/v1/projects/${p.id}/activity`);
      const moves = activity.body.filter((a: { action: string }) => a.action === 'STATUS_CHANGE');
      expect(moves.map((a: { details: { status: string } }) => a.details.status)).toEqual(['ACTIVE', 'ON_HOLD', 'ACTIVE', 'COMPLETED', 'CLOSED']);
      expect(moves[1].reason).toBe('Client payment delay');
    });

    it('rejects invalid transitions and incomplete moves with 422', async () => {
      const p = await newProject();
      const move = (status: string, reason?: string, agent: Agent = w.admin) => agent.post(`/v1/projects/${p.id}/status`).send({ status, reason });
      expect((await move('COMPLETED')).status).toBe(422);
      expect((await move('CLOSED')).status).toBe(422);
      expect((await move('ACTIVE')).status).toBe(422);
      await w.admin.patch(`/v1/projects/${p.id}`).send({ startDate: '2026-03-01' });
      expect((await move('ACTIVE')).status).toBe(200);
      expect((await move('ON_HOLD')).status).toBe(422);
      expect((await move('CANCELLED', 'Client withdrew')).status).toBe(200);
      expect((await move('ACTIVE')).status).toBe(422);
      expect((await w.admin.patch(`/v1/projects/${p.id}`).send({ name: 'edit after cancel' })).status).toBe(422);
      expect((await w.admin.post(`/v1/projects/${p.id}/status`).send({ status: 'NOPE' })).status).toBe(400);
    });

    it('does not let a project end while procurement documents are still open', async () => {
      const p = await activeProject();
      await ctx.prisma.purchaseRequisition.create({
        data: { companyId: w.company.id, number: uniq('PR'), projectId: p.id, requesterId: w.users.pm, status: 'DRAFT' },
      });
      const res = await w.admin.post(`/v1/projects/${p.id}/status`).send({ status: 'COMPLETED' });
      expect(res.status).toBe(422);
      expect(res.body.detail).toContain('open requisition');
    });

    it('closing a project needs the CLOSE permission', async () => {
      const p = await activeProject();
      await w.admin.post(`/v1/projects/${p.id}/status`).send({ status: 'COMPLETED' });
      const engineer = await w.engineer.post(`/v1/projects/${p.id}/status`).send({ status: 'CLOSED' });
      expect(engineer.status).toBe(403);
      expect((await w.pm.post(`/v1/projects/${p.id}/status`).send({ status: 'CLOSED' })).status).toBe(200);
    });

    it('only one of two simultaneous identical status changes wins', async () => {
      const p = await activeProject();
      const send = () => w.admin.post(`/v1/projects/${p.id}/status`).send({ status: 'ON_HOLD', reason: 'Weather' });
      const [a, b] = await Promise.all([send(), send()]);
      expect([a.status, b.status].sort()).toEqual([200, 422]);
    });

    it('deletes only an unused pipeline project', async () => {
      const unused = await newProject();
      expect((await w.admin.delete(`/v1/projects/${unused.id}`)).status).toBe(204);
      expect((await w.admin.get(`/v1/projects/${unused.id}`)).status).toBe(404);
      const withWbs = await newProject();
      await w.admin.post(`/v1/projects/${withWbs.id}/wbs`).send({ code: '1', name: 'Site works' });
      expect((await w.admin.delete(`/v1/projects/${withWbs.id}`)).status).toBe(422);
      const active = await activeProject();
      expect((await w.admin.delete(`/v1/projects/${active.id}`)).status).toBe(422);
    });
  });

  describe('team', () => {
    it('adds, changes and removes members, refusing duplicates and users from other companies', async () => {
      const p = await newProject();
      const added = await w.admin.post(`/v1/projects/${p.id}/members`).send({ userId: w.users.engineer, role: 'Project Engineer' });
      expect(added.status).toBe(201);
      expect((await w.admin.post(`/v1/projects/${p.id}/members`).send({ userId: w.users.engineer, role: 'Again' })).status).toBe(409);
      expect((await w.admin.post(`/v1/projects/${p.id}/members`).send({ userId: foreign.users.pm, role: 'Spy' })).status).toBe(422);
      expect((await w.admin.post(`/v1/projects/${p.id}/members`).send({ userId: w.users.pm })).status).toBe(400);
      const changed = await w.admin.patch(`/v1/projects/${p.id}/members/${added.body.id}`).send({ role: 'Lead Engineer' });
      expect(changed.body.role).toBe('Lead Engineer');
      const list = await w.admin.get(`/v1/projects/${p.id}/members`);
      expect(list.body).toHaveLength(1);
      expect(list.body[0].user.id).toBe(w.users.engineer);
      expect((await w.admin.delete(`/v1/projects/${p.id}/members/${added.body.id}`)).status).toBe(204);
      expect((await w.admin.delete(`/v1/projects/${p.id}/members/${added.body.id}`)).status).toBe(404);
      expect((await w.viewer.post(`/v1/projects/${p.id}/members`).send({ userId: w.users.pm, role: 'x' })).status).toBe(403);
    });
  });

  describe('contract', () => {
    it('keeps one active contract per project and feeds the project contract amount', async () => {
      const p = await newProject();
      const first = await w.admin.post(`/v1/projects/${p.id}/contracts`).send({ title: 'Main contract', originalAmount: '12500000.00', signedDate: '2026-01-10' });
      expect(first.status).toBe(201);
      expect(first.body).toMatchObject({ status: 'DRAFT', originalAmount: '12500000', currentAmount: '12500000' });
      expect(first.body.number).toMatch(/^CT-\d{4}-\d{5}$/);

      const edited = await w.admin.patch(`/v1/contracts/${first.body.id}`).send({ originalAmount: '13000000' });
      expect(edited.body.currentAmount).toBe('13000000');

      const activated = await w.admin.post(`/v1/contracts/${first.body.id}/activate`).send({});
      expect(activated.body.status).toBe('APPROVED');
      expect((await w.admin.get(`/v1/projects/${p.id}`)).body).toMatchObject({ contractAmount: '13000000', activeContract: { id: first.body.id } });
      expect((await w.admin.patch(`/v1/contracts/${first.body.id}`).send({ title: 'late edit' })).status).toBe(422);
      expect((await w.admin.patch(`/v1/projects/${p.id}`).send({ contractAmount: '1' })).status).toBe(422);

      const second = await w.admin.post(`/v1/projects/${p.id}/contracts`).send({ title: 'Variation contract', originalAmount: '500000' });
      expect((await w.admin.post(`/v1/contracts/${second.body.id}/activate`).send({})).status).toBe(422);
      expect((await w.admin.post(`/v1/contracts/${first.body.id}/close`).send({ reason: 'Superseded' })).body.status).toBe('CLOSED');
      expect((await w.admin.post(`/v1/contracts/${second.body.id}/activate`).send({})).status).toBe(200);
      expect((await w.admin.get(`/v1/projects/${p.id}/contracts`)).body).toHaveLength(2);
    });

    it('only one of two simultaneous activations succeeds', async () => {
      const p = await newProject();
      const a = await w.admin.post(`/v1/projects/${p.id}/contracts`).send({ title: 'A', originalAmount: '100' });
      const b = await w.admin.post(`/v1/projects/${p.id}/contracts`).send({ title: 'B', originalAmount: '200' });
      const [ra, rb] = await Promise.all([
        w.admin.post(`/v1/contracts/${a.body.id}/activate`).send({}),
        w.admin.post(`/v1/contracts/${b.body.id}/activate`).send({}),
      ]);
      expect([ra.status, rb.status].sort()).toEqual([200, 422]);
      expect(await ctx.prisma.contract.count({ where: { projectId: p.id, status: 'APPROVED' } })).toBe(1);
    });

    it('validates, cancels drafts, and enforces permission and scope', async () => {
      const p = await newProject();
      expect((await w.admin.post(`/v1/projects/${p.id}/contracts`).send({ title: '', originalAmount: '-1' })).status).toBe(400);
      const c = await w.admin.post(`/v1/projects/${p.id}/contracts`).send({ title: 'Draft', originalAmount: '10' });
      expect((await w.admin.post(`/v1/contracts/${c.body.id}/cancel`).send({ reason: 'x' })).status).toBe(400);
      expect((await w.admin.post(`/v1/contracts/${c.body.id}/cancel`).send({ reason: 'Client changed scope' })).body.status).toBe('CANCELLED');
      expect((await w.admin.post(`/v1/contracts/${c.body.id}/activate`).send({})).status).toBe(422);
      const other = await newProject();
      const scoped = await userAgent(w, ['Project Manager'], { projectId: other.id });
      expect((await scoped.agent.post(`/v1/projects/${p.id}/contracts`).send({ title: 'x', originalAmount: '1' })).status).toBe(403);
      expect((await scoped.agent.post(`/v1/contracts/${c.body.id}/close`).send({ reason: 'xxx' })).status).toBe(403);
      expect((await w.viewer.get(`/v1/projects/${p.id}/contracts`)).status).toBe(403);
      expect((await foreign.admin.post(`/v1/contracts/${c.body.id}/activate`).send({})).status).toBe(404);
    });
  });

  describe('WBS', () => {
    it('builds a tree depth-first with levels and rejects duplicate codes', async () => {
      const p = await newProject();
      const root = await expectOk<Json>(await w.admin.post(`/v1/projects/${p.id}/wbs`).send({ code: '1', name: 'Building A', sortOrder: 1 }));
      const sub = await expectOk<Json>(await w.admin.post(`/v1/projects/${p.id}/wbs`).send({ code: '1.1', name: 'Substructure', parentId: root.id, weightPct: '25' }));
      await w.admin.post(`/v1/projects/${p.id}/wbs`).send({ code: '1.1.1', name: 'Excavation', parentId: sub.id });
      await w.admin.post(`/v1/projects/${p.id}/wbs`).send({ code: '2', name: 'Building B', sortOrder: 2 });
      expect((await w.admin.post(`/v1/projects/${p.id}/wbs`).send({ code: '1.1', name: 'Again', parentId: root.id })).status).toBe(409);
      const tree = await w.admin.get(`/v1/projects/${p.id}/wbs`);
      expect(tree.body.map((n: Json) => [n.code, n.depth, n.hasChildren])).toEqual([['1', 1, true], ['1.1', 2, true], ['1.1.1', 3, false], ['2', 1, false]]);
    });

    it('validates input and project ownership of the parent', async () => {
      const p = await newProject();
      const q = await newProject();
      const foreignNode = await expectOk<Json>(await w.admin.post(`/v1/projects/${q.id}/wbs`).send({ code: 'Q1', name: 'Other project node' }));
      expect((await w.admin.post(`/v1/projects/${p.id}/wbs`).send({ code: '', name: '' })).status).toBe(400);
      expect((await w.admin.post(`/v1/projects/${p.id}/wbs`).send({ code: 'X', name: 'x', parentId: foreignNode.id })).status).toBe(422);
      expect((await w.admin.post(`/v1/projects/${p.id}/wbs`).send({ code: 'X', name: 'x', weightPct: '150' })).status).toBe(400);
      expect((await ctx.http().get(`/v1/projects/${p.id}/wbs`)).status).toBe(401);
      expect((await foreign.admin.post(`/v1/projects/${p.id}/wbs`).send({ code: 'F', name: 'x' })).status).toBe(404);
    });

    it('moves a subtree, recomputes levels, and refuses cycles and cross-project moves', async () => {
      const p = await newProject();
      const q = await newProject();
      const a = await expectOk<Json>(await w.admin.post(`/v1/projects/${p.id}/wbs`).send({ code: 'A', name: 'A' }));
      const b = await expectOk<Json>(await w.admin.post(`/v1/projects/${p.id}/wbs`).send({ code: 'B', name: 'B' }));
      const a1 = await expectOk<Json>(await w.admin.post(`/v1/projects/${p.id}/wbs`).send({ code: 'A1', name: 'A1', parentId: a.id }));
      await w.admin.post(`/v1/projects/${p.id}/wbs`).send({ code: 'A1a', name: 'A1a', parentId: a1.id });
      const moved = await w.admin.post(`/v1/wbs/${a.id}/move`).send({ parentId: b.id });
      expect(moved.status).toBe(200);
      const tree = await w.admin.get(`/v1/projects/${p.id}/wbs`);
      expect(Object.fromEntries(tree.body.map((n: Json) => [n.code, n.level]))).toEqual({ A: 2, B: 1, A1: 3, A1a: 4 });
      expect((await w.admin.post(`/v1/wbs/${b.id}/move`).send({ parentId: a1.id })).status).toBe(422);
      expect((await w.admin.post(`/v1/wbs/${b.id}/move`).send({ parentId: b.id })).status).toBe(422);
      const other = await expectOk<Json>(await w.admin.post(`/v1/projects/${q.id}/wbs`).send({ code: 'Q', name: 'Q' }));
      expect((await w.admin.post(`/v1/wbs/${a.id}/move`).send({ parentId: other.id })).status).toBe(422);
      expect((await w.admin.post(`/v1/wbs/${a.id}/move`).send({ parentId: null })).status).toBe(200);
      expect((await foreign.admin.post(`/v1/wbs/${a.id}/move`).send({ parentId: null })).status).toBe(404);
    });

    it('renames, scopes by project, and deletes only unused leaves (freeing the code)', async () => {
      const p = await newProject();
      const parent = await expectOk<Json>(await w.admin.post(`/v1/projects/${p.id}/wbs`).send({ code: 'P', name: 'Parent' }));
      const leaf = await expectOk<Json>(await w.admin.post(`/v1/projects/${p.id}/wbs`).send({ code: 'L', name: 'Leaf', parentId: parent.id }));
      expect((await w.admin.patch(`/v1/wbs/${leaf.id}`).send({ name: 'Leaf renamed', weightPct: '40' })).body).toMatchObject({ name: 'Leaf renamed', weightPct: '40' });
      expect((await w.admin.delete(`/v1/wbs/${parent.id}`)).status).toBe(422);
      const activity = await w.admin.get(`/v1/wbs/${leaf.id}/activity`);
      expect(activity.body.map((a: { action: string }) => a.action)).toEqual(['CREATE', 'UPDATE']);
      expect((await w.admin.delete(`/v1/wbs/${leaf.id}`)).status).toBe(204);
      expect((await w.admin.get(`/v1/wbs/${leaf.id}/activity`)).status).toBe(404);
      expect((await w.admin.post(`/v1/projects/${p.id}/wbs`).send({ code: 'L', name: 'Leaf again', parentId: parent.id })).status).toBe(201);
      const scoped = await userAgent(w, ['Project Manager'], { projectId: w.otherProject.id });
      expect((await scoped.agent.patch(`/v1/wbs/${parent.id}`).send({ name: 'x' })).status).toBe(403);
      expect((await scoped.agent.get(`/v1/projects/${p.id}/wbs`)).status).toBe(403);
    });
  });

  describe('cost codes', () => {
    it('keeps a per-company hierarchy with categories, duplicate protection and filters', async () => {
      const tag = uniq('CC');
      const root = await expectOk<Json>(await w.admin.post('/v1/cost-codes').send({ code: `${tag}-03`, name: 'Concrete', category: 'MATERIAL' }));
      const child = await expectOk<Json>(await w.admin.post('/v1/cost-codes').send({ code: `${tag}-03.10`, name: 'Ready-mix', category: 'MATERIAL', parentId: root.id }));
      await w.admin.post('/v1/cost-codes').send({ code: `${tag}-90`, name: 'Crane rental', category: 'EQUIPMENT' });
      expect((await w.admin.post('/v1/cost-codes').send({ code: `${tag}-03`, name: 'dup' })).status).toBe(409);
      expect((await w.admin.post('/v1/cost-codes').send({ code: `${tag}-X`, name: 'x', category: 'WIDGETS' })).status).toBe(400);
      expect((await w.admin.get('/v1/cost-codes').query({ search: tag, category: 'EQUIPMENT' })).body.items).toHaveLength(1);
      expect((await w.admin.get('/v1/cost-codes').query({ parentId: root.id })).body.items.map((c: Json) => c.id)).toEqual([child.id]);
      expect((await w.admin.patch(`/v1/cost-codes/${root.id}`).send({ parentId: child.id })).status).toBe(422);
      expect((await w.admin.delete(`/v1/cost-codes/${root.id}`)).status).toBe(422);
      expect((await w.admin.patch(`/v1/cost-codes/${child.id}`).send({ active: false })).body.active).toBe(false);
      expect((await w.admin.delete(`/v1/cost-codes/${child.id}`)).status).toBe(204);
      expect((await w.admin.post('/v1/cost-codes').send({ code: `${tag}-03.10`, name: 'Reused code', parentId: root.id })).status).toBe(201);
    });

    it('is company-scoped, permissioned and rejects foreign parents', async () => {
      const theirs = await expectOk<Json>(await foreign.admin.post('/v1/cost-codes').send({ code: uniq('FCC'), name: 'Foreign' }));
      expect((await w.admin.get(`/v1/cost-codes/${theirs.id}`)).status).toBe(404);
      expect((await w.admin.post('/v1/cost-codes').send({ code: uniq('X'), name: 'x', parentId: theirs.id })).status).toBe(422);
      expect((await ctx.http().get('/v1/cost-codes')).status).toBe(401);
      expect((await w.buyer.post('/v1/cost-codes').send({ code: uniq('B'), name: 'x' })).status).toBe(403);
    });
  });

  describe('estimate, BOQ and control budget', () => {
    it('creates estimate versions, prices BOQ items and rolls up totals', async () => {
      const p = await newProject();
      const e1 = await w.admin.post(`/v1/projects/${p.id}/estimates`).send({ name: 'Tender estimate', overheadPct: '10', profitPct: '8', taxPct: '12' });
      expect(e1.status).toBe(201);
      expect(e1.body).toMatchObject({ version: 1, status: 'DRAFT' });
      expect((await w.admin.post(`/v1/projects/${p.id}/estimates`).send({})).body.version).toBe(2);

      const wbs = await expectOk<Json>(await w.admin.post(`/v1/projects/${p.id}/wbs`).send({ code: '1', name: 'Structure' }));
      const cc = await expectOk<Json>(await w.admin.post('/v1/cost-codes').send({ code: uniq('CC'), name: 'Concrete' }));
      const a = await boq(w.admin, e1.body.id, '1.01', { quantity: '12.5', unitRate: '8450.75', wbsNodeId: wbs.id, costCodeId: cc.id, costCategory: 'MATERIAL', section: 'Structure' });
      expect(a.status).toBe(201);
      expect(a.body).toMatchObject({ amount: '105634.38', materialCost: '105634.38', laborCost: '0' });
      await boq(w.admin, e1.body.id, '1.02', { quantity: '100', unitRate: '350', costCategory: 'LABOR' });
      const detail = await w.admin.get(`/v1/estimates/${e1.body.id}`);
      // direct 140634.38; overhead 14063.44; profit 11250.75; tax on 165948.57 = 19913.83
      expect(detail.body).toMatchObject({ itemCount: 2, directCost: '140634.38', totalAmount: '185862.4' });
    });

    it('validates BOQ input, duplicate item numbers and WBS/cost code ownership', async () => {
      const p = await newProject();
      const q = await newProject();
      const e = await expectOk<Json>(await w.admin.post(`/v1/projects/${p.id}/estimates`).send({}));
      const foreignWbs = await expectOk<Json>(await w.admin.post(`/v1/projects/${q.id}/wbs`).send({ code: '1', name: 'Other project' }));
      const foreignCode = await expectOk<Json>(await foreign.admin.post('/v1/cost-codes').send({ code: uniq('FCC'), name: 'Foreign' }));
      expect((await boq(w.admin, e.id, '', { quantity: '0' })).status).toBe(400);
      expect((await boq(w.admin, e.id, '1', { quantity: '1.00001' })).status).toBe(400);
      expect((await boq(w.admin, e.id, '1', { wbsNodeId: foreignWbs.id })).status).toBe(422);
      expect((await boq(w.admin, e.id, '1', { costCodeId: foreignCode.id })).status).toBe(422);
      expect((await boq(w.admin, e.id, '1')).status).toBe(201);
      expect((await boq(w.admin, e.id, '1')).status).toBe(409);
      expect((await boq(w.viewer, e.id, '2')).status).toBe(403);
      expect((await ctx.http().post(`/v1/estimates/${e.id}/items`).send({ itemNo: '2', description: 'x', unit: 'm3', quantity: '1', unitRate: '1' })).status).toBe(401);
      expect((await boq(foreign.admin, e.id, '2')).status).toBe(404);
    });

    it('edits and removes BOQ items while the estimate is a draft, recomputing totals', async () => {
      const p = await newProject();
      const e = await expectOk<Json>(await w.admin.post(`/v1/projects/${p.id}/estimates`).send({}));
      const a = await expectOk<Json>(await boq(w.admin, e.id, '1'));
      const b = await expectOk<Json>(await boq(w.admin, e.id, '2'));
      expect((await w.admin.get(`/v1/estimates/${e.id}`)).body.directCost).toBe('2000');
      const upd = await w.admin.patch(`/v1/boq-items/${a.id}`).send({ quantity: '20' });
      expect(upd.body).toMatchObject({ quantity: '20', amount: '2000' });
      expect((await w.admin.delete(`/v1/boq-items/${b.id}`)).status).toBe(204);
      expect((await w.admin.get(`/v1/estimates/${e.id}`)).body).toMatchObject({ directCost: '2000', itemCount: 1 });
      expect((await boq(w.admin, e.id, '2')).status).toBe(201);
    });

    it('approving an estimate creates a control budget with one line per BOQ item', async () => {
      const p = await newProject();
      const e = await expectOk<Json>(await w.admin.post(`/v1/projects/${p.id}/estimates`).send({ overheadPct: '10' }));
      expect((await w.admin.post(`/v1/estimates/${e.id}/approve`).send({})).status).toBe(422);
      const wbs = await expectOk<Json>(await w.admin.post(`/v1/projects/${p.id}/wbs`).send({ code: '1', name: 'Works' }));
      const a = await expectOk<Json>(await boq(w.admin, e.id, '1', { quantity: '3', unitRate: '1000.50', wbsNodeId: wbs.id }));
      const b = await expectOk<Json>(await boq(w.admin, e.id, '2', { quantity: '2', unitRate: '250', costCategory: 'LABOR' }));

      expect((await w.viewer.post(`/v1/estimates/${e.id}/approve`).send({})).status).toBe(403);
      const approved = await w.admin.post(`/v1/estimates/${e.id}/approve`).send({});
      expect(approved.status).toBe(200);
      expect(approved.body.estimate).toMatchObject({ status: 'APPROVED', approvedById: expect.any(String) });
      expect(approved.body.budget).toMatchObject({ version: 1, isCurrent: true, isOriginal: true, totalAmount: '3501.5' });
      const lines = approved.body.budget.lines as Json[];
      expect(lines).toHaveLength(2);
      expect(lines.find((l) => l.boqItemId === a.id)).toMatchObject({ amount: '3001.5', category: 'MATERIAL', wbsNodeId: wbs.id, quantity: '3' });
      expect(lines.find((l) => l.boqItemId === b.id)).toMatchObject({ amount: '500', category: 'LABOR' });

      expect((await w.admin.post(`/v1/estimates/${e.id}/approve`).send({})).status).toBe(422);
      expect((await w.admin.patch(`/v1/estimates/${e.id}`).send({ overheadPct: '5' })).status).toBe(422);
      expect((await boq(w.admin, e.id, '3')).status).toBe(422);
      expect((await w.admin.patch(`/v1/boq-items/${a.id}`).send({ quantity: '9' })).status).toBe(422);
      expect((await w.admin.delete(`/v1/boq-items/${a.id}`)).status).toBe(422);

      const current = await w.admin.get(`/v1/projects/${p.id}/budget`);
      expect(current.body).toMatchObject({ version: 1, totalAmount: '3501.5' });
      expect(current.body.lines[0].boqItem.itemNo).toBeDefined();
      const boqList = await w.admin.get(`/v1/projects/${p.id}/boq`);
      expect(boqList.body.items).toHaveLength(2);
    });

    it('a revised estimate supersedes the approved one and becomes the next budget version', async () => {
      const p = await newProject();
      const e1 = await expectOk<Json>(await w.admin.post(`/v1/projects/${p.id}/estimates`).send({}));
      await boq(w.admin, e1.id, '1', { quantity: '1', unitRate: '1000' });
      await w.admin.post(`/v1/estimates/${e1.id}/approve`).send({});
      const e2 = await expectOk<Json>(await w.admin.post(`/v1/projects/${p.id}/estimates`).send({ type: 'REVISED' }));
      await boq(w.admin, e2.id, '1', { quantity: '1', unitRate: '1500' });
      const second = await w.admin.post(`/v1/estimates/${e2.id}/approve`).send({});
      expect(second.body.budget).toMatchObject({ version: 2, isCurrent: true, isOriginal: false, totalAmount: '1500' });
      expect((await w.admin.get(`/v1/estimates/${e1.id}`)).body.status).toBe('CLOSED');
      const budgets = await w.admin.get(`/v1/projects/${p.id}/budgets`);
      expect(budgets.body.map((b: Json) => [b.version, b.isCurrent])).toEqual([[2, true], [1, false]]);
      expect((await w.admin.get(`/v1/projects/${p.id}/budget`).query({ version: 1 })).body.totalAmount).toBe('1000');
      expect((await w.admin.get(`/v1/projects/${p.id}/boq`)).body.items.map((i: Json) => i.estimateId)).toEqual([e2.id]);
    });

    it('only one of two simultaneous approvals of the same estimate succeeds', async () => {
      const p = await newProject();
      const e = await expectOk<Json>(await w.admin.post(`/v1/projects/${p.id}/estimates`).send({}));
      await boq(w.admin, e.id, '1');
      const [a, b] = await Promise.all([w.admin.post(`/v1/estimates/${e.id}/approve`).send({}), w.admin.post(`/v1/estimates/${e.id}/approve`).send({})]);
      expect([a.status, b.status].sort()).toEqual([200, 422]);
      expect(await ctx.prisma.budget.count({ where: { projectId: p.id } })).toBe(1);
    });

    it('enforces project scope on estimates, BOQ and budget', async () => {
      const p = await newProject();
      const e = await expectOk<Json>(await w.admin.post(`/v1/projects/${p.id}/estimates`).send({}));
      const scoped = await userAgent(w, ['Quantity Surveyor'], { projectId: w.otherProject.id });
      expect((await scoped.agent.get(`/v1/estimates/${e.id}`)).status).toBe(403);
      expect((await scoped.agent.get(`/v1/projects/${p.id}/boq`)).status).toBe(403);
      expect((await scoped.agent.get(`/v1/projects/${p.id}/budget`)).status).toBe(403);
      expect((await scoped.agent.post(`/v1/projects/${p.id}/estimates`).send({})).status).toBe(403);
      expect((await w.admin.get(`/v1/projects/${p.id}/budget`)).status).toBe(404);
    });
  });

  describe('dashboard', () => {
    it('reports only real aggregates: contract, budget, actual cost, and zero committed with no purchase orders', async () => {
      const p = await activeProject();
      const empty = await w.admin.get(`/v1/projects/${p.id}/dashboard`);
      expect(empty.status).toBe(200);
      expect(empty.body.financial).toMatchObject({ contractValue: '0.00', contractValueSource: 'PROJECT', budget: null, committed: '0.00', actual: '0.00' });
      expect(empty.body.counts).toMatchObject({ openRequisitions: 0, openPurchaseOrders: 0, wbsNodes: 0, boqItems: 0 });
      expect(empty.body).not.toHaveProperty('forecast');

      const contract = await w.admin.post(`/v1/projects/${p.id}/contracts`).send({ title: 'Main', originalAmount: '8000000' });
      await w.admin.post(`/v1/contracts/${contract.body.id}/activate`).send({});
      const e = await expectOk<Json>(await w.admin.post(`/v1/projects/${p.id}/estimates`).send({}));
      await boq(w.admin, e.id, '1', { quantity: '10', unitRate: '500' });
      await w.admin.post(`/v1/estimates/${e.id}/approve`).send({});
      await w.admin.post(`/v1/projects/${p.id}/wbs`).send({ code: '1', name: 'Works' });
      await ctx.prisma.$transaction((tx) =>
        ctx.app.get(CostLedgerService).record(tx, {
          companyId: w.company.id, projectId: p.id, costCategory: 'MATERIAL', txnType: 'MATERIAL_ISSUE', txnDate: new Date(),
          totalCost: '1234.56', sourceType: 'TEST', sourceId: 'dash', userId: w.users.admin,
        }),
      );
      const res = await w.admin.get(`/v1/projects/${p.id}/dashboard`);
      expect(res.body.financial).toMatchObject({ contractValue: '8000000.00', contractValueSource: 'CONTRACT', actual: '1234.56' });
      expect(res.body.financial.budget).toMatchObject({ version: 1, totalAmount: '5000.00' });
      expect(res.body.counts).toMatchObject({ wbsNodes: 1, boqItems: 1 });
    });

    it('hides financials from users without budget permission and respects project scope', async () => {
      const p = await activeProject();
      const res = await w.viewer.get(`/v1/projects/${p.id}/dashboard`);
      expect(res.status).toBe(200);
      expect(res.body.financial).toBeNull();
      expect(res.body.counts).toBeDefined();
      expect((await ctx.http().get(`/v1/projects/${p.id}/dashboard`)).status).toBe(401);
    });
  });

  describe('dimension foreign keys', () => {
    it('the cost ledger now refuses dimension ids that are not real records of the same company', async () => {
      const p = await newProject();
      const row = (extra: Record<string, unknown>) =>
        ctx.prisma.projectCostLedger.create({
          data: { companyId: w.company.id, projectId: p.id, costCategory: 'MATERIAL', txnType: 'MATERIAL_ISSUE', txnDate: new Date(), totalCost: 1, sourceType: 'T', sourceId: 'x', userId: 'u', ...extra },
        });
      await expect(row({ warehouseId: '00000000-0000-4000-8000-000000000001' })).rejects.toThrow();
      await expect(row({ itemId: '00000000-0000-4000-8000-000000000002' })).rejects.toThrow();
      await expect(row({ branchId: '00000000-0000-4000-8000-000000000003' })).rejects.toThrow();
      const foreignWarehouse = await ctx.prisma.warehouse.create({ data: { companyId: foreign.company.id, code: uniq('FWH'), name: 'Foreign' } });
      await expect(row({ warehouseId: foreignWarehouse.id })).rejects.toThrow(/Cross-company reference: warehouse/);
      const good = await row({ warehouseId: w.warehouse.id });
      expect(good.warehouseId).toBe(w.warehouse.id);
    });

    it('journal lines refuse dangling or foreign dimension ids', async () => {
      const cash = await ctx.prisma.account.findFirstOrThrow({ where: { companyId: w.company.id, code: '1000' } });
      const entry = await ctx.prisma.journalEntry.create({
        data: { companyId: w.company.id, entryNo: uniq('JE'), entryDate: new Date(), description: 'dimension test', postedById: 'u' },
      });
      const line = (extra: Record<string, unknown>) => ctx.prisma.journalLine.create({ data: { entryId: entry.id, accountId: cash.id, debit: 1, ...extra } });
      await expect(line({ projectId: '00000000-0000-4000-8000-000000000009' })).rejects.toThrow();
      await expect(line({ wbsNodeId: '00000000-0000-4000-8000-000000000009' })).rejects.toThrow();
      const foreignCode = await ctx.prisma.costCode.create({ data: { companyId: foreign.company.id, code: uniq('JCC'), name: 'Foreign' } });
      await expect(line({ costCodeId: foreignCode.id })).rejects.toThrow(/Cross-company reference: cost code/);
      expect((await line({ projectId: w.project.id })).projectId).toBe(w.project.id);
    });
  });
});
