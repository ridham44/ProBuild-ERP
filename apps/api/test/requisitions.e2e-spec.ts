import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startApp, stopApp, TestContext } from './support/app';
import { buildWorld, createItem, expectOk, idemKey, Json, setWorkflow, uniq, userAgent, World } from './support/world';

describe('Purchase requisition workflow', () => {
  let ctx: TestContext;
  let w: World;
  let foreign: World;
  let cement: Json;
  let rebar: Json;

  beforeAll(async () => {
    ctx = await startApp();
    w = await buildWorld(ctx, 'PR');
    foreign = await buildWorld(ctx, 'PRX');
    // <= 50,000: Project Manager only. Above: Project Manager then Finance.
    await setWorkflow(w.admin, 'PURCHASE_REQUISITION', [
      { minAmount: '0', maxAmount: '50000', steps: ['Project Manager'] },
      { minAmount: '50000.01', steps: ['Project Manager', 'Finance'] },
    ]);
    cement = await createItem(w.admin, uniq('CEM'), { name: 'Portland cement 40kg', baseUnit: 'bag' });
    await ctx.prisma.item.update({ where: { id: cement.id }, data: { lastPurchaseCost: '250', standardCost: '240' } });
    rebar = await createItem(w.admin, uniq('RB'), { name: '16mm deformed bar', baseUnit: 'pc', costingMethod: 'STANDARD', standardCost: '125.5' });
  });
  afterAll(() => stopApp(ctx));

  const body = (lines: Array<Record<string, unknown>>, extra: Record<string, unknown> = {}) => ({
    projectId: w.project.id, warehouseId: w.warehouse.id, lines, ...extra,
  });
  const create = async (lines: Array<Record<string, unknown>> = [{ itemId: cement.id, qty: '10' }], extra: Record<string, unknown> = {}): Promise<Json> =>
    expectOk<Json>(await w.engineer.post('/v1/requisitions').send(body(lines, extra)));
  const submit = (id: string, key = idemKey('sub')) => w.engineer.post(`/v1/requisitions/${id}/submit`).set('Idempotency-Key', key).send({});
  const approveAs = (agent: typeof w.pm, id: string, key = idemKey('apr')) => agent.post(`/v1/requisitions/${id}/approve`).set('Idempotency-Key', key).send({});
  /** A submitted requisition below the first approval band. */
  const submitted = async (qty = '10'): Promise<Json> => {
    const pr = await create([{ itemId: cement.id, qty }]);
    await expectOk(await submit(pr.id));
    return pr;
  };

  describe('create and read', () => {
    it('creates a draft with server-estimated amounts from last purchase cost, then standard cost', async () => {
      const res = await w.engineer.post('/v1/requisitions').send(
        body(
          [
            { itemId: cement.id, qty: '12.5', description: 'For slab pour', justification: 'Slab on grade, level 2', requiredDate: '2026-11-20' },
            { itemId: rebar.id, qty: '100' },
            { itemId: rebar.id, qty: '4', estimatedUnitCost: '130.1234' },
          ],
          { priority: 'HIGH', purpose: 'Level 2 slab', requiredDate: '2026-11-25' },
        ),
      );
      expect(res.status).toBe(201);
      expect(res.body.number).toMatch(/^PR-\d{4}-\d{5}$/);
      expect(res.body).toMatchObject({ status: 'DRAFT', priority: 'HIGH', requesterId: w.users.engineer, project: { id: w.project.id } });
      const [a, b, c] = res.body.lines as Json[];
      expect(a).toMatchObject({ lineNo: 1, qty: '12.5', unit: 'bag', estimatedUnitCost: '250', estimatedAmount: '3125', description: 'For slab pour', justification: 'Slab on grade, level 2', remainingQty: '12.5' });
      expect(b).toMatchObject({ lineNo: 2, estimatedUnitCost: '125.5', estimatedAmount: '12550' });
      expect(c).toMatchObject({ estimatedUnitCost: '130.1234', estimatedAmount: '520.49' });
      expect(res.body.estimatedTotal).toBe('16195.49');
      expect(res.body.approvals).toEqual([]);
    });

    it('stores WBS, cost code, BOQ item and warehouse per line', async () => {
      const wbs = await expectOk<Json>(await w.admin.post(`/v1/projects/${w.project.id}/wbs`).send({ code: uniq('W'), name: 'Superstructure' }));
      const cc = await expectOk<Json>(await w.admin.post('/v1/cost-codes').send({ code: uniq('CC'), name: 'Concrete materials' }));
      const estimate = await expectOk<Json>(await w.admin.post(`/v1/projects/${w.project.id}/estimates`).send({}));
      const boq = await expectOk<Json>(await w.admin.post(`/v1/estimates/${estimate.id}/items`).send({ itemNo: '1', description: 'Concrete', unit: 'm3', quantity: '10', unitRate: '100', wbsNodeId: wbs.id, costCodeId: cc.id }));
      await w.admin.post(`/v1/estimates/${estimate.id}/approve`).send({});
      const pr = await create([{ itemId: cement.id, qty: '5', wbsNodeId: wbs.id, costCodeId: cc.id, boqItemId: boq.id, warehouseId: w.warehouse.id }]);
      expect((pr.lines as Json[])[0]).toMatchObject({
        wbsNode: { id: wbs.id }, costCode: { id: cc.id }, boqItem: { id: boq.id }, warehouse: { id: w.warehouse.id }, item: { id: cement.id },
      });
    });

    it('rejects structurally invalid input with 400', async () => {
      const cases: Array<Record<string, unknown>> = [
        body([]),
        body([{ itemId: cement.id, qty: '0' }]),
        body([{ itemId: cement.id, qty: '1.00001' }]),
        body([{ itemId: 'not-a-uuid', qty: '1' }]),
        { ...body([{ itemId: cement.id, qty: '1' }]), projectId: undefined },
        body([{ itemId: cement.id, qty: '1', estimatedUnitCost: '-5' }]),
      ];
      for (const c of cases) expect((await w.engineer.post('/v1/requisitions').send(c)).status).toBe(400);
    });

    it('rejects references that do not belong to the company or project with 422 and field paths', async () => {
      const theirItem = await createItem(foreign.admin, uniq('THEIRS'));
      const theirWh = await foreign.admin.post('/v1/warehouses').send({ code: uniq('FW'), name: 'Foreign WH' });
      const theirCode = await expectOk<Json>(await foreign.admin.post('/v1/cost-codes').send({ code: uniq('FCC'), name: 'Foreign' }));
      const otherWbs = await expectOk<Json>(await w.admin.post(`/v1/projects/${w.otherProject.id}/wbs`).send({ code: uniq('OW'), name: 'Other project WBS' }));
      const draftEstimate = await expectOk<Json>(await w.admin.post(`/v1/projects/${w.project.id}/estimates`).send({}));
      const draftBoq = await expectOk<Json>(await w.admin.post(`/v1/estimates/${draftEstimate.id}/items`).send({ itemNo: '1', description: 'x', unit: 'u', quantity: '1', unitRate: '1' }));
      const otherEstimate = await expectOk<Json>(await w.admin.post(`/v1/projects/${w.otherProject.id}/estimates`).send({}));
      const otherBoq = await expectOk<Json>(await w.admin.post(`/v1/estimates/${otherEstimate.id}/items`).send({ itemNo: '1', description: 'x', unit: 'u', quantity: '1', unitRate: '1' }));
      await w.admin.post(`/v1/estimates/${otherEstimate.id}/approve`).send({});
      const inactive = await createItem(w.admin, uniq('OFF'));
      await w.admin.patch(`/v1/items/${inactive.id}`).send({ active: false });

      const attempts: Array<[Record<string, unknown>, string]> = [
        [{ itemId: theirItem.id, qty: '1' }, 'lines.0.itemId'],
        [{ itemId: cement.id, qty: '1', warehouseId: theirWh.body.id }, 'lines.0.warehouseId'],
        [{ itemId: cement.id, qty: '1', costCodeId: theirCode.id }, 'lines.0.costCodeId'],
        [{ itemId: cement.id, qty: '1', wbsNodeId: otherWbs.id }, 'lines.0.wbsNodeId'],
        [{ itemId: cement.id, qty: '1', boqItemId: otherBoq.id }, 'lines.0.boqItemId'],
        [{ itemId: cement.id, qty: '1', boqItemId: draftBoq.id }, 'lines.0.boqItemId'],
        [{ itemId: cement.id, qty: '1', unit: 'furlong' }, 'lines.0.unit'],
        [{ itemId: inactive.id, qty: '1' }, 'lines.0.itemId'],
      ];
      for (const [line, path] of attempts) {
        const res = await w.engineer.post('/v1/requisitions').send(body([line]));
        expect(res.status, JSON.stringify(res.body)).toBe(422);
        expect((res.body.errors as Array<{ path: string }>).map((e) => e.path)).toContain(path);
      }
      expect((await w.engineer.post('/v1/requisitions').send(body([{ itemId: cement.id, qty: '1' }], { warehouseId: theirWh.body.id }))).status).toBe(422);
    });

    it('requires authentication, permission and company membership', async () => {
      expect((await ctx.http().get('/v1/requisitions')).status).toBe(401);
      expect((await ctx.http().post('/v1/requisitions').send(body([{ itemId: cement.id, qty: '1' }]))).status).toBe(401);
      expect((await w.viewer.get('/v1/requisitions')).status).toBe(403);
      expect((await w.viewer.post('/v1/requisitions').send(body([{ itemId: cement.id, qty: '1' }]))).status).toBe(403);
      const pr = await create();
      expect((await foreign.admin.get(`/v1/requisitions/${pr.id}`)).status).toBe(404);
      expect((await foreign.admin.patch(`/v1/requisitions/${pr.id}`).send({ purpose: 'x' })).status).toBe(404);
      expect((await foreign.admin.post(`/v1/requisitions/${pr.id}/cancel`).send({ reason: 'hijack' })).status).toBe(404);
      expect((await foreign.admin.get(`/v1/requisitions/${pr.id}/activity`)).status).toBe(404);
      const theirProject = await foreign.admin.post('/v1/requisitions').send({ projectId: pr.projectId, lines: [{ itemId: cement.id, qty: '1' }] });
      expect(theirProject.status).toBe(404);
    });

    it('limits project-scoped users to their own project', async () => {
      const mine = await userAgent(w, ['Project Engineer'], { projectId: w.project.id });
      const pr = await create();
      const otherPr = await expectOk<Json>(await w.admin.post('/v1/requisitions').send({ projectId: w.otherProject.id, lines: [{ itemId: cement.id, qty: '1' }] }));
      expect((await mine.agent.get(`/v1/requisitions/${pr.id}`)).status).toBe(200);
      expect((await mine.agent.get(`/v1/requisitions/${otherPr.id}`)).status).toBe(403);
      expect((await mine.agent.patch(`/v1/requisitions/${otherPr.id}`).send({ purpose: 'x' })).status).toBe(403);
      expect((await mine.agent.post(`/v1/requisitions/${otherPr.id}/cancel`).send({ reason: 'not mine' })).status).toBe(403);
      const create2 = await mine.agent.post('/v1/requisitions').send({ projectId: w.otherProject.id, lines: [{ itemId: cement.id, qty: '1' }] });
      expect(create2.status).toBe(403);
      const list = await mine.agent.get('/v1/requisitions').query({ limit: 100 });
      const projects = new Set((list.body.items as Json[]).map((r) => r.projectId));
      expect([...projects]).toEqual([w.project.id]);
    });

    it('lists with filters, search, sorting and cursor pagination', async () => {
      const mark = uniq('LIST');
      const a = await create([{ itemId: cement.id, qty: '1' }], { purpose: mark, priority: 'URGENT' });
      const b = await create([{ itemId: cement.id, qty: '2' }], { purpose: mark });
      const c = await create([{ itemId: cement.id, qty: '3' }], { purpose: mark });
      const p1 = await w.engineer.get('/v1/requisitions').query({ search: mark, limit: 2, sort: 'number:desc' });
      expect(p1.body.items.map((r: Json) => r.id)).toEqual([c.id, b.id]);
      const p2 = await w.engineer.get('/v1/requisitions').query({ search: mark, limit: 2, sort: 'number:desc', cursor: p1.body.nextCursor });
      expect(p2.body.items.map((r: Json) => r.id)).toEqual([a.id]);
      expect((await w.engineer.get('/v1/requisitions').query({ search: mark, priority: 'URGENT' })).body.items.map((r: Json) => r.id)).toEqual([a.id]);
      expect((await w.engineer.get('/v1/requisitions').query({ search: mark, status: 'APPROVED' })).body.items).toHaveLength(0);
      expect((await w.engineer.get('/v1/requisitions').query({ search: a.number })).body.items).toHaveLength(1);
      expect((await w.engineer.get('/v1/requisitions').query({ status: 'BOGUS' })).status).toBe(400);
      expect((await w.engineer.get('/v1/requisitions').query({ sort: 'purpose:asc' })).status).toBe(400);
    });
  });

  describe('edit', () => {
    it('edits a draft (header and a replaced line set) and refuses edits once submitted', async () => {
      const pr = await create([{ itemId: cement.id, qty: '10' }]);
      const edited = await w.engineer.patch(`/v1/requisitions/${pr.id}`).send({ purpose: 'Revised purpose', lines: [{ itemId: rebar.id, qty: '20' }, { itemId: cement.id, qty: '3' }] });
      expect(edited.status).toBe(200);
      expect(edited.body.purpose).toBe('Revised purpose');
      expect(edited.body.lines).toHaveLength(2);
      expect(edited.body.estimatedTotal).toBe('3260');
      const keep = await w.engineer.patch(`/v1/requisitions/${pr.id}`).send({ remarks: 'Header only' });
      expect(keep.body.lines).toHaveLength(2);
      expect((await w.engineer.patch(`/v1/requisitions/${pr.id}`).send({ lines: [] })).status).toBe(400);
      expect((await w.engineer.patch(`/v1/requisitions/${pr.id}`).send({ projectId: w.otherProject.id })).body.projectId).toBe(w.project.id);
      await expectOk(await submit(pr.id));
      const late = await w.engineer.patch(`/v1/requisitions/${pr.id}`).send({ purpose: 'too late' });
      expect(late.status).toBe(422);
    });
  });

  describe('submit and approve', () => {
    it('submits into the amount-band workflow, creates an approval request and notifies the approver role', async () => {
      const pr = await create([{ itemId: cement.id, qty: '10' }]);
      const res = await submit(pr.id);
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ status: 'SUBMITTED', submittedAt: expect.any(String) });
      expect(res.body.approvals).toHaveLength(1);
      expect(res.body.approvals[0]).toMatchObject({ status: 'PENDING', totalSteps: 1, currentRole: 'Project Manager', amount: '2500.00' });
      expect(res.body.approvals[0].steps).toEqual([expect.objectContaining({ step: 1, role: 'Project Manager', state: 'CURRENT' })]);
      const notes = await ctx.prisma.notification.findMany({ where: { companyId: w.company.id, entityId: pr.id, type: 'APPROVAL_PENDING' } });
      expect(notes.map((n) => n.userId)).toContain(w.users.pm);
    });

    it('routes a larger requisition through two approval steps in order', async () => {
      const pr = await create([{ itemId: cement.id, qty: '300' }]);
      expect((await submit(pr.id)).body.approvals[0]).toMatchObject({ totalSteps: 2, amount: '75000.00' });
      expect((await approveAs(w.finance, pr.id)).status).toBe(403);
      const first = await approveAs(w.pm, pr.id);
      expect(first.status).toBe(200);
      expect(first.body.status).toBe('SUBMITTED');
      expect(first.body.approvals[0]).toMatchObject({ currentStep: 2, currentRole: 'Finance' });
      expect((await approveAs(w.pm, pr.id)).status).toBe(403);
      const last = await approveAs(w.finance, pr.id);
      expect(last.body).toMatchObject({ status: 'APPROVED', approvedAt: expect.any(String) });
      expect(last.body.approvals[0].steps.map((s: Json) => s.state)).toEqual(['APPROVED', 'APPROVED']);
    });

    it('is idempotent: a retry with the same key replays the first response and creates one approval request', async () => {
      const pr = await create();
      const key = idemKey('sub');
      const first = await submit(pr.id, key);
      const retry = await submit(pr.id, key);
      expect(first.status).toBe(200);
      expect(retry.status).toBe(200);
      expect(retry.headers['idempotent-replayed']).toBe('true');
      expect(retry.body).toEqual(first.body);
      expect(await ctx.prisma.approvalRequest.count({ where: { documentId: pr.id } })).toBe(1);
      expect(await ctx.prisma.auditLog.count({ where: { entityId: pr.id, action: 'SUBMIT' } })).toBe(1);

      expect((await w.engineer.post(`/v1/requisitions/${pr.id}/submit`).send({})).status).toBe(400);
      const other = await create();
      const reused = await submit(other.id, key);
      expect(reused.status).toBe(422);
      const fresh = await submit(pr.id);
      expect(fresh.status).toBe(422);
    });

    it('approval is idempotent: replays return the same result without a second decision', async () => {
      const pr = await submitted();
      const key = idemKey('apr');
      const first = await approveAs(w.pm, pr.id, key);
      const retry = await approveAs(w.pm, pr.id, key);
      expect(first.body.status).toBe('APPROVED');
      expect(retry.headers['idempotent-replayed']).toBe('true');
      expect(retry.body).toEqual(first.body);
      expect(await ctx.prisma.approvalAction.count({ where: { request: { documentId: pr.id } } })).toBe(1);
      expect((await approveAs(w.pm, pr.id)).status).toBe(422);
    });

    it('enforces who may approve: not the requester, not the wrong role, not the wrong project scope', async () => {
      const pr = await submitted();
      const requesterPm = await userAgent(w, ['Project Manager']);
      const ownPr = await expectOk<Json>(await requesterPm.agent.post('/v1/requisitions').send(body([{ itemId: cement.id, qty: '1' }])));
      await requesterPm.agent.post(`/v1/requisitions/${ownPr.id}/submit`).set('Idempotency-Key', idemKey()).send({});
      expect((await approveAs(requesterPm.agent, ownPr.id)).status).toBe(403);

      expect((await approveAs(w.finance, pr.id)).status).toBe(403);
      expect((await approveAs(w.viewer, pr.id)).status).toBe(403);
      expect((await approveAs(w.engineer, pr.id)).status).toBe(403);
      const wrongScope = await userAgent(w, ['Project Manager'], { projectId: w.otherProject.id });
      expect((await approveAs(wrongScope.agent, pr.id)).status).toBe(403);
      expect((await approveAs(foreign.admin, pr.id)).status).toBe(404);
      expect((await ctx.http().post(`/v1/requisitions/${pr.id}/approve`).set('Idempotency-Key', idemKey()).send({})).status).toBe(401);
      expect((await w.pm.get(`/v1/requisitions/${pr.id}`)).body.status).toBe('SUBMITTED');
      const rightScope = await userAgent(w, ['Project Manager'], { projectId: w.project.id });
      expect((await approveAs(rightScope.agent, pr.id)).body.status).toBe('APPROVED');
    });

    it('only one of two simultaneous approvals wins and the status changes once', async () => {
      const pr = await submitted();
      const second = await userAgent(w, ['Project Manager']);
      const [a, b] = await Promise.all([approveAs(w.pm, pr.id), approveAs(second.agent, pr.id)]);
      expect([a.status, b.status].sort()).toEqual([200, 422]);
      expect(await ctx.prisma.approvalAction.count({ where: { request: { documentId: pr.id } } })).toBe(1);
      expect((await ctx.prisma.purchaseRequisition.findUniqueOrThrow({ where: { id: pr.id } })).status).toBe('APPROVED');
    });

    it('rejects with a mandatory comment and the document ends REJECTED', async () => {
      const pr = await submitted();
      const reject = (comment?: string) => w.pm.post(`/v1/requisitions/${pr.id}/reject`).set('Idempotency-Key', idemKey('rej')).send(comment ? { comment } : {});
      expect((await reject()).status).toBe(400);
      const res = await reject('Over budget for this scope');
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ status: 'REJECTED', rejectedAt: expect.any(String) });
      expect(res.body.approvals[0]).toMatchObject({ status: 'REJECTED' });
      expect((await approveAs(w.pm, pr.id)).status).toBe(422);
      expect((await w.engineer.post(`/v1/requisitions/${pr.id}/cancel`).send({ reason: 'cleanup' })).status).toBe(422);
      expect((await submit(pr.id)).status).toBe(422);
      const notes = await ctx.prisma.notification.findMany({ where: { entityId: pr.id, type: 'APPROVAL_RESULT' } });
      expect(notes.map((n) => n.userId)).toContain(w.users.engineer);
    });

    it('the generic approval inbox endpoint also moves the requisition', async () => {
      const pr = await submitted();
      const request = await ctx.prisma.approvalRequest.findFirstOrThrow({ where: { documentId: pr.id } });
      expect((await w.pm.post(`/v1/approvals/${request.id}/approve`).send({ comment: 'ok' })).status).toBe(201);
      expect((await ctx.prisma.purchaseRequisition.findUniqueOrThrow({ where: { id: pr.id } })).status).toBe('APPROVED');
    });

    it('only submits drafts of an active project and revalidates item state', async () => {
      const pr = await create();
      await ctx.prisma.project.update({ where: { id: w.project.id }, data: { status: 'ON_HOLD' } });
      const held = await submit(pr.id);
      await ctx.prisma.project.update({ where: { id: w.project.id }, data: { status: 'ACTIVE' } });
      expect(held.status).toBe(422);
      expect(held.body.detail).toContain('ACTIVE');
      const item = await createItem(w.admin, uniq('SOON-OFF'));
      const withItem = await create([{ itemId: item.id, qty: '1' }]);
      await w.admin.patch(`/v1/items/${item.id}`).send({ active: false });
      expect((await submit(withItem.id)).status).toBe(422);
      expect((await w.viewer.post(`/v1/requisitions/${pr.id}/submit`).set('Idempotency-Key', idemKey()).send({})).status).toBe(403);
    });

    it('auto-approves when no approval workflow applies and the requester is notified of readiness', async () => {
      const item = await createItem(foreign.admin, uniq('AUTO'));
      await ctx.prisma.item.update({ where: { id: item.id }, data: { standardCost: '10', lastPurchaseCost: '10' } });
      const engineer = await userAgent(foreign, ['Project Engineer']);
      const created = await expectOk<Json>(await engineer.agent.post('/v1/requisitions').send({ projectId: foreign.project.id, lines: [{ itemId: item.id, qty: '5' }] }));
      const res = await engineer.agent.post(`/v1/requisitions/${created.id}/submit`).set('Idempotency-Key', idemKey()).send({});
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ status: 'APPROVED', approvedAt: expect.any(String), approvals: [] });
      const activity = await engineer.agent.get(`/v1/requisitions/${created.id}/activity`);
      expect(activity.body.map((a: { action: string }) => a.action)).toEqual(['CREATE', 'AUTO_APPROVE']);
      expect((await engineer.agent.post(`/v1/requisitions/${created.id}/approve`).set('Idempotency-Key', idemKey()).send({})).status).toBe(403);
    });
  });

  describe('cancel and close', () => {
    it('cancels a draft, a submitted (withdrawing its approval request) and an approved requisition', async () => {
      const draft = await create();
      expect((await w.engineer.post(`/v1/requisitions/${draft.id}/cancel`).send({})).status).toBe(400);
      const cancelled = await w.engineer.post(`/v1/requisitions/${draft.id}/cancel`).send({ reason: 'Raised by mistake' });
      expect(cancelled.body).toMatchObject({ status: 'CANCELLED', cancelReason: 'Raised by mistake', cancelledAt: expect.any(String) });

      const sub = await submitted();
      expect((await w.engineer.post(`/v1/requisitions/${sub.id}/cancel`).send({ reason: 'Scope removed' })).body.status).toBe('CANCELLED');
      expect((await ctx.prisma.approvalRequest.findFirstOrThrow({ where: { documentId: sub.id } })).status).toBe('CANCELLED');
      expect((await approveAs(w.pm, sub.id)).status).toBe(422);

      const appr = await submitted();
      await approveAs(w.pm, appr.id);
      expect((await w.engineer.post(`/v1/requisitions/${appr.id}/cancel`).send({ reason: 'No longer needed' })).body.status).toBe('CANCELLED');
      expect((await w.engineer.post(`/v1/requisitions/${appr.id}/cancel`).send({ reason: 'Again please' })).status).toBe(422);
      expect((await w.viewer.post(`/v1/requisitions/${appr.id}/cancel`).send({ reason: 'not allowed' })).status).toBe(403);
    });

    it('closes only approved requisitions and records the reason', async () => {
      const draft = await create();
      expect((await w.pm.post(`/v1/requisitions/${draft.id}/close`).send({ reason: 'Not yet approved' })).status).toBe(422);
      const pr = await submitted();
      await approveAs(w.pm, pr.id);
      expect((await w.engineer.post(`/v1/requisitions/${pr.id}/close`).send({ reason: 'engineer cannot close' })).status).toBe(403);
      const closed = await w.pm.post(`/v1/requisitions/${pr.id}/close`).send({ reason: 'Purchased from stock instead' });
      expect(closed.body).toMatchObject({ status: 'CLOSED', closeReason: 'Purchased from stock instead' });
      expect((await w.pm.post(`/v1/requisitions/${pr.id}/close`).send({ reason: 'Close twice' })).status).toBe(422);
    });
  });

  describe('activity timeline', () => {
    it('lists audit entries and approval decisions in order with actor names', async () => {
      const pr = await create();
      await submit(pr.id);
      await approveAs(w.pm, pr.id);
      await w.pm.post(`/v1/requisitions/${pr.id}/close`).send({ reason: 'Done sourcing' });
      const res = await w.pm.get(`/v1/requisitions/${pr.id}/activity`);
      expect(res.status).toBe(200);
      const trail = res.body as Array<{ action: string; kind: string; actor: { name: string } | null; at: string; reason: string | null }>;
      expect(trail.map((t) => t.action)).toEqual(['CREATE', 'SUBMIT', 'APPROVED', 'STATUS_CHANGE', 'CLOSE']);
      expect(trail.map((t) => t.kind)).toEqual(['AUDIT', 'AUDIT', 'APPROVAL', 'AUDIT', 'AUDIT']);
      expect(trail.every((t) => t.actor === null || t.actor.name === 'Test User')).toBe(true);
      expect(trail[4]!.reason).toBe('Done sourcing');
      const times = trail.map((t) => new Date(t.at).getTime());
      expect([...times].sort((x, y) => x - y)).toEqual(times);
      expect((await w.viewer.get(`/v1/requisitions/${pr.id}/activity`)).status).toBe(403);
      expect((await ctx.http().get(`/v1/requisitions/${pr.id}/activity`)).status).toBe(401);
    });
  });
});
