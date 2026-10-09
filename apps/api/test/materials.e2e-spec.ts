import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startApp, stopApp, TestContext } from './support/app';
import { createWarehouse } from './support/fixtures';
import { ProjectDims, projectDims, StockActors, stockActors, stockOf, stockUp } from './support/stock';
import { Agent, buildWorld, createItem, expectOk, idemKey, Json, setWorkflow, uniq, userAgent, World } from './support/world';

type Mr = Json & { status: string; lines: Array<Json & { id: string }>; approvals: Array<Json & { steps: Json[] }> };
type Mi = Json & { status: string; totalCost: string; lines: Json[] };

describe('Material request, issue, return and project cost', () => {
  let ctx: TestContext;
  let w: World;
  let rival: World;
  let a: StockActors;
  let dims: ProjectDims;
  let cement: Json;
  let site: Agent;

  const createMr = (agent: Agent, lines: Array<Record<string, unknown>>, extra: Record<string, unknown> = {}) =>
    agent.post('/v1/material-requests').send({ projectId: w.project.id, warehouseId: w.warehouse.id, purpose: 'Foundation pour', lines, ...extra });
  const line = (itemId: string, qty: string, extra: Record<string, unknown> = {}) => ({ itemId, qty, wbsNodeId: dims.wbs.id, costCodeId: dims.costCode.id, boqItemId: dims.boq.id, ...extra });
  const submit = (agent: Agent, id: string) => agent.post(`/v1/material-requests/${id}/submit`).set('Idempotency-Key', idemKey('mr-sub'));
  const approve = (agent: Agent, id: string, body: Record<string, unknown> = {}) => agent.post(`/v1/material-requests/${id}/approve`).set('Idempotency-Key', idemKey('mr-apr')).send(body);

  /** An approved request (workflow: Project Manager) ready for issuing. */
  const approvedMr = async (itemId: string, qty: string, extra: Record<string, unknown> = {}): Promise<Mr> => {
    const created = await expectOk<Mr>(await createMr(w.engineer, [line(itemId, qty)], extra), 201);
    await expectOk(await submit(w.engineer, created.id).send({}), 200);
    return expectOk<Mr>(await approve(w.pm, created.id), 200);
  };
  const issueFrom = (agent: Agent, requestId: string, lines?: Array<Record<string, unknown>>) => agent.post('/v1/material-issues').send({ requestId, ...(lines ? { lines } : {}) });
  const postIssue = (agent: Agent, id: string, key = idemKey('mi')) => agent.post(`/v1/material-issues/${id}/post`).set('Idempotency-Key', key).send({});

  beforeAll(async () => {
    ctx = await startApp();
    w = await buildWorld(ctx, 'Mat');
    rival = await buildWorld(ctx, 'MatRival');
    a = await stockActors(w);
    site = (await userAgent(w, ['Site Engineer'])).agent;
    dims = await projectDims(w);
    cement = await createItem(w.admin, uniq('CEM'), { baseUnit: 'bag' });
    await stockUp(w, a, [{ itemId: cement.id, qty: '100', unitPrice: '50' }]);
    await setWorkflow(w.admin, 'MATERIAL_REQUEST', [{ minAmount: '0', steps: ['Project Manager'] }]);
  });
  afterAll(() => stopApp(ctx));

  describe('material request', () => {
    it('requires authentication and the right permission', async () => {
      expect((await ctx.http().get('/v1/material-requests')).status).toBe(401);
      expect((await ctx.http().post('/v1/material-requests').send({})).status).toBe(401);
      expect((await w.finance.get('/v1/material-requests')).status).toBe(403);
      expect((await createMr(w.finance, [line(cement.id, '1')])).status).toBe(403);
    });

    it('validates input shape', async () => {
      expect((await createMr(w.engineer, [])).status).toBe(400);
      expect((await createMr(w.engineer, [line(cement.id, '0')])).status).toBe(400);
      expect((await createMr(w.engineer, [{ itemId: 'x', qty: '1' }])).status).toBe(400);
      expect((await w.engineer.post('/v1/material-requests').send({ warehouseId: w.warehouse.id, lines: [line(cement.id, '1')] })).status).toBe(400);
    });

    it('rejects WBS, BOQ, item, unit and warehouse that do not fit the project', async () => {
      const other = await projectDims(w, w.otherProject.id);
      const wrongWbs = await createMr(w.engineer, [line(cement.id, '1', { wbsNodeId: other.wbs.id })]);
      expect(wrongWbs.status).toBe(422);
      expect(wrongWbs.body.errors[0]).toMatchObject({ path: 'lines.0.wbsNodeId' });
      const wrongBoq = await createMr(w.engineer, [line(cement.id, '1', { boqItemId: other.boq.id })]);
      expect(wrongBoq.body.errors[0]).toMatchObject({ path: 'lines.0.boqItemId' });

      const restricted = await createItem(w.admin, uniq('RST'), { baseUnit: 'pc' });
      await ctx.prisma.item.update({ where: { id: restricted.id as string }, data: { restrictedProjectId: w.otherProject.id } });
      const res = await createMr(w.engineer, [line(restricted.id as string, '1')]);
      expect(res.status).toBe(422);
      expect(res.body.errors[0].message).toMatch(/restricted to another project/);

      expect((await createMr(w.engineer, [line(cement.id, '1', { unit: 'drum' })])).status).toBe(422);
      const projectWarehouse = await ctx.prisma.warehouse.create({ data: { companyId: w.company.id, code: uniq('PWH'), name: 'Other site store', type: 'SITE', projectId: w.otherProject.id } });
      const wh = await createMr(w.engineer, [line(cement.id, '1')], { warehouseId: projectWarehouse.id });
      expect(wh.status).toBe(422);
      expect(wh.body.errors[0]).toMatchObject({ path: 'warehouseId' });
    });

    it('is invisible to and unusable by another company', async () => {
      const mr = await expectOk<Mr>(await createMr(w.engineer, [line(cement.id, '2')]), 201);
      expect((await rival.admin.get(`/v1/material-requests/${mr.id}`)).status).toBe(404);
      expect((await rival.admin.post(`/v1/material-requests/${mr.id}/cancel`).send({ reason: 'sabotage' })).status).toBe(404);
      expect((await rival.admin.get('/v1/material-requests')).body.items).toHaveLength(0);
      const foreign = await rival.engineer.post('/v1/material-requests').send({ projectId: w.project.id, warehouseId: w.warehouse.id, lines: [{ itemId: cement.id, qty: '1' }] });
      expect(foreign.status).toBe(404);
    });

    it('respects project and warehouse scope', async () => {
      const scoped = await userAgent(w, ['Project Engineer'], { projectId: w.otherProject.id });
      const mr = await expectOk<Mr>(await createMr(w.engineer, [line(cement.id, '2')]), 201);
      expect((await scoped.agent.get(`/v1/material-requests/${mr.id}`)).status).toBe(403);
      expect((await createMr(scoped.agent, [line(cement.id, '1')])).status).toBe(403);
      expect((await scoped.agent.get('/v1/material-requests')).body.items).toHaveLength(0);
      const other = await createWarehouse(ctx.prisma, w.company, uniq('OW'));
      const whScoped = await userAgent(w, ['Project Engineer'], { warehouseId: other.id });
      expect((await whScoped.agent.get(`/v1/material-requests/${mr.id}`)).status).toBe(403);
    });

    it('goes DRAFT -> SUBMITTED -> APPROVED, with quantities lowered by the approver and stock reserved', async () => {
      const created = await expectOk<Mr>(await createMr(w.engineer, [line(cement.id, '60')]), 201);
      expect(created).toMatchObject({ status: 'DRAFT', estimatedTotal: '3000' });
      expect(created.number).toMatch(/^MR-/);
      expect(created.lines[0]).toMatchObject({ qty: '60', unit: 'bag', remainingQty: '0' });
      expect((await w.engineer.patch(`/v1/material-requests/${created.id}`).send({ remarks: 'Pour on Saturday' })).body.remarks).toBe('Pour on Saturday');

      const key = idemKey('sub');
      const submitted = await w.engineer.post(`/v1/material-requests/${created.id}/submit`).set('Idempotency-Key', key).send({});
      expect(submitted.body).toMatchObject({ status: 'SUBMITTED' });
      expect(submitted.body.approvals[0]).toMatchObject({ totalSteps: 1, currentRole: 'Project Manager' });
      expect(submitted.body.lines[0]).toMatchObject({ approvedQty: '60' });
      const replay = await w.engineer.post(`/v1/material-requests/${created.id}/submit`).set('Idempotency-Key', key).send({});
      expect(replay.headers['idempotent-replayed']).toBe('true');
      expect((await submit(w.engineer, created.id).send({})).status).toBe(422);
      expect((await w.engineer.patch(`/v1/material-requests/${created.id}`).send({ remarks: 'late' })).status).toBe(422);
      const lineId = created.lines[0]!.id;

      // not reserved while it only awaits approval
      expect((await stockOf(w.admin, cement.id))).toMatchObject({ reserved: '0' });

      // who may approve: not the requester, not another role; and a refused approver cannot touch quantities
      expect((await approve(w.engineer, created.id, { lines: [{ lineId, approvedQty: '1' }] })).status).toBe(403);
      expect((await approve(w.finance, created.id, { lines: [{ lineId, approvedQty: '1' }] })).status).toBe(403);
      expect((await w.pm.get(`/v1/material-requests/${created.id}`)).body.lines[0].approvedQty).toBe('60');
      // quantity rules
      expect((await approve(w.pm, created.id, { lines: [{ lineId, approvedQty: '61' }] })).status).toBe(422);
      expect((await approve(w.pm, created.id, { lines: [{ lineId, approvedQty: '0' }] })).status).toBe(422);
      expect((await approve(w.pm, created.id, { lines: [{ lineId: '00000000-0000-4000-8000-000000000000', approvedQty: '5' }] })).status).toBe(422);

      const approved = await approve(w.pm, created.id, { comment: 'Reduced to what the pour needs', lines: [{ lineId, approvedQty: '40' }] });
      expect(approved.status).toBe(200);
      expect(approved.body).toMatchObject({ status: 'APPROVED' });
      expect(approved.body.lines[0]).toMatchObject({ qty: '60', approvedQty: '40', issuedQty: '0', remainingQty: '40' });
      expect(await stockOf(w.admin, cement.id)).toMatchObject({ onHand: '100', reserved: '40', available: '60' });
      const row = (await a.wm.get('/v1/inventory/stock-balances').query({ itemId: cement.id })).body.items[0];
      expect(row).toMatchObject({ onHand: '100', reserved: '40', available: '60' });
      expect((await approve(w.pm, created.id)).status).toBe(422);

      const trail = await w.pm.get(`/v1/material-requests/${created.id}/activity`);
      expect(trail.body.map((t: { action: string }) => t.action)).toEqual(expect.arrayContaining(['CREATE', 'SUBMIT', 'QTY_ADJUSTED', 'APPROVED', 'STATUS_CHANGE']));
      // an approved, un-issued request can be cancelled: the reservation is released
      expect((await w.engineer.post(`/v1/material-requests/${created.id}/cancel`).send({ reason: 'Pour postponed' })).status).toBe(403);
      expect((await w.pm.post(`/v1/material-requests/${created.id}/cancel`).send({ reason: 'Pour postponed' })).body.status).toBe('CANCELLED');
      expect(await stockOf(w.admin, cement.id)).toMatchObject({ reserved: '0' });
    });

    it('rejects with a mandatory comment and handles invalid transitions', async () => {
      const mr = await expectOk<Mr>(await createMr(w.engineer, [line(cement.id, '5')]), 201);
      await submit(w.engineer, mr.id).send({});
      expect((await w.pm.post(`/v1/material-requests/${mr.id}/reject`).set('Idempotency-Key', idemKey()).send({})).status).toBe(400);
      const rejected = await w.pm.post(`/v1/material-requests/${mr.id}/reject`).set('Idempotency-Key', idemKey()).send({ comment: 'Use the stock already on site' });
      expect(rejected.body.status).toBe('REJECTED');
      expect((await w.pm.post(`/v1/material-requests/${mr.id}/cancel`).send({ reason: 'too late now' })).status).toBe(422);
      expect((await w.pm.post(`/v1/material-requests/${mr.id}/close`).send({ reason: 'not approved' })).status).toBe(422);
      expect((await issueFrom(a.ws, mr.id)).status).toBe(422);
      const draft = await expectOk<Mr>(await createMr(w.engineer, [line(cement.id, '5')]), 201);
      expect((await w.pm.post(`/v1/material-requests/${draft.id}/approve`).set('Idempotency-Key', idemKey()).send({})).status).toBe(422);
    });

    it('auto-approves without a workflow and lists with filters', async () => {
      const solo = await buildWorld(ctx, 'MatSolo');
      const sa = await stockActors(solo);
      const sdims = await projectDims(solo);
      const item = await createItem(solo.admin, uniq('NW'), { baseUnit: 'pc' });
      await stockUp(solo, sa, [{ itemId: item.id, qty: '10', unitPrice: '10' }]);
      const mr = await expectOk<Mr>(await solo.engineer.post('/v1/material-requests').send({ projectId: solo.project.id, warehouseId: solo.warehouse.id, lines: [{ itemId: item.id, qty: '4', wbsNodeId: sdims.wbs.id }] }), 201);
      const res = await solo.engineer.post(`/v1/material-requests/${mr.id}/submit`).set('Idempotency-Key', idemKey()).send({});
      expect(res.body.status).toBe('APPROVED');
      expect(res.body.lines[0]).toMatchObject({ approvedQty: '4' });
      expect((await solo.engineer.get('/v1/material-requests').query({ status: 'APPROVED', issuable: 'true', projectId: solo.project.id })).body.items).toHaveLength(1);

      const page1 = await w.pm.get('/v1/material-requests').query({ limit: 2 });
      expect(page1.body.items).toHaveLength(2);
      const page2 = await w.pm.get('/v1/material-requests').query({ limit: 2, cursor: page1.body.nextCursor });
      expect(page2.body.items[0].id).not.toBe(page1.body.items[0].id);
      expect((await w.pm.get('/v1/material-requests').query({ search: 'MR-' })).body.items.length).toBeGreaterThan(0);
    });
  });

  describe('material issue', () => {
    let batchItem: Json;

    it('issues from an approved request: ledger, issued quantities and project cost land in one transaction', async () => {
      const item = await createItem(w.admin, uniq('ISS'), { baseUnit: 'bag' });
      await stockUp(w, a, [{ itemId: item.id, qty: '100', unitPrice: '50' }]);
      const mr = await approvedMr(item.id as string, '40');
      const mrLine = mr.lines[0]!.id;

      // no direct access without a request, over-issue and bad lines are refused
      expect((await a.ws.post('/v1/material-issues').send({ projectId: w.project.id, warehouseId: w.warehouse.id, remarks: 'urgent', lines: [{ itemId: item.id, qty: '1' }] })).status).toBe(403);
      expect((await issueFrom(a.ws, mr.id as string, [{ requestLineId: mrLine, qty: '45' }])).status).toBe(422);
      expect((await issueFrom(a.ws, mr.id as string, [{ requestLineId: '00000000-0000-4000-8000-000000000000', qty: '1' }])).status).toBe(422);
      expect((await issueFrom(a.ws, mr.id as string, [{ requestLineId: mrLine, qty: '1', batchNo: 'B1' }])).status).toBe(422);
      expect((await w.finance.post('/v1/material-issues').send({ requestId: mr.id })).status).toBe(403);
      expect((await ctx.http().post('/v1/material-issues').send({ requestId: mr.id })).status).toBe(401);

      const draft = await expectOk<Mi>(await issueFrom(a.ws, mr.id as string, [{ requestLineId: mrLine, qty: '15' }]), 201);
      expect(draft).toMatchObject({ status: 'DRAFT', totalCost: '0' });
      expect(draft.number).toMatch(/^MIV-/);
      const key = idemKey('issue');
      const posted = await postIssue(a.ws, draft.id, key);
      expect(posted.status).toBe(200);
      expect(posted.body).toMatchObject({ status: 'POSTED', totalCost: '750' });
      expect(posted.body.lines[0]).toMatchObject({ qty: '15', unitCost: '50', totalCost: '750', baseQty: '15', returnableQty: '15' });
      expect(posted.body.lines[0].wbsNode.id).toBe(dims.wbs.id);
      expect(posted.body.lines[0].boqItem.id).toBe(dims.boq.id);
      expect(posted.body.lines[0].costCode.id).toBe(dims.costCode.id);

      // inventory
      expect(await stockOf(w.admin, item.id)).toMatchObject({ onHand: '85', reserved: '25', available: '60', value: '4250' });
      const ledger = await ctx.prisma.stockLedger.findFirstOrThrow({ where: { companyId: w.company.id, sourceType: 'MATERIAL_ISSUE', sourceId: draft.id } });
      expect(ledger).toMatchObject({ txnType: 'PROJECT_ISSUE', projectId: w.project.id, wbsNodeId: dims.wbs.id, costCodeId: dims.costCode.id, boqItemId: dims.boq.id, userId: a.wsId });
      expect(ledger.qty.toString()).toBe('-15');
      // project cost ledger
      const cost = await ctx.prisma.projectCostLedger.findFirstOrThrow({ where: { companyId: w.company.id, sourceType: 'MATERIAL_ISSUE', sourceId: draft.id } });
      expect(cost).toMatchObject({
        projectId: w.project.id, wbsNodeId: dims.wbs.id, boqItemId: dims.boq.id, costCodeId: dims.costCode.id, itemId: item.id, warehouseId: w.warehouse.id,
        txnType: 'MATERIAL_ISSUE', costCategory: 'MATERIAL', userId: a.wsId,
      });
      expect([cost.quantity.toString(), cost.unitCost.toString(), cost.totalCost.toString()]).toEqual(['15', '50', '750']);
      // request shows Requested / Approved / Issued / Remaining
      const after = (await w.pm.get(`/v1/material-requests/${mr.id}`)).body as Mr;
      expect(after.lines[0]).toMatchObject({ qty: '40', approvedQty: '40', issuedQty: '15', remainingQty: '25' });
      expect(after.issues).toHaveLength(1);

      // idempotent and double post
      const replay = await postIssue(a.ws, draft.id, key);
      expect(replay.headers['idempotent-replayed']).toBe('true');
      const again = await postIssue(a.ws, draft.id);
      expect(again.status).toBe(422);
      expect(await ctx.prisma.projectCostLedger.count({ where: { companyId: w.company.id, sourceType: 'MATERIAL_ISSUE', sourceId: draft.id } })).toBe(1);
      expect((await a.ws.patch(`/v1/material-issues/${draft.id}`).send({ remarks: 'edit after post' })).status).toBe(422);

      // the dashboard's actual cost is the cost ledger sum
      const dash = await w.admin.get(`/v1/projects/${w.project.id}/dashboard`);
      expect(Number(dash.body.financial.actual)).toBeGreaterThanOrEqual(750);

      // the rest of the request, then nothing is left
      const second = await expectOk<Mi>(await issueFrom(a.ws, mr.id as string), 201);
      expect(second.lines[0]).toMatchObject({ qty: '25' });
      await expectOk(await postIssue(a.ws, second.id), 200);
      expect((await w.pm.get(`/v1/material-requests/${mr.id}`)).body.lines[0]).toMatchObject({ issuedQty: '40', remainingQty: '0' });
      const none = await issueFrom(a.ws, mr.id as string);
      expect(none.status).toBe(422);
      expect(none.body.detail).toMatch(/Nothing is left/);
    });

    it('available = on hand minus what OTHER requests reserved', async () => {
      const item = await createItem(w.admin, uniq('RES'), { baseUnit: 'pc' });
      await stockUp(w, a, [{ itemId: item.id, qty: '100', unitPrice: '10' }]);
      const mrA = await approvedMr(item.id as string, '40');
      const mrB = await approvedMr(item.id as string, '70');
      expect(await stockOf(w.admin, item.id)).toMatchObject({ onHand: '100', reserved: '110', available: '-10' });

      const tooMuch = await expectOk<Mi>(await issueFrom(a.ws, mrA.id as string), 201);
      const refused = await postIssue(a.ws, tooMuch.id);
      expect(refused.status).toBe(422);
      expect(refused.body.detail).toMatch(/available 30 \(on hand 100, reserved for other requests 70\)/);
      expect(await ctx.prisma.stockLedger.count({ where: { companyId: w.company.id, itemId: item.id as string, txnType: 'PROJECT_ISSUE' } })).toBe(0);

      await expectOk(await a.ws.patch(`/v1/material-issues/${tooMuch.id}`).send({ lines: [{ requestLineId: mrA.lines[0]!.id, qty: '30' }] }), 200);
      await expectOk(await postIssue(a.ws, tooMuch.id), 200);
      const rest = await expectOk<Mi>(await issueFrom(a.ws, mrA.id as string), 201);
      expect((await postIssue(a.ws, rest.id)).status).toBe(422);
      // B may take what is left after A's own 10 stay reserved: 70 on hand - 10 = 60
      const bTooMuch = await expectOk<Mi>(await issueFrom(a.ws, mrB.id as string), 201);
      expect((await postIssue(a.ws, bTooMuch.id)).status).toBe(422);
      await expectOk(await a.ws.patch(`/v1/material-issues/${bTooMuch.id}`).send({ lines: [{ requestLineId: mrB.lines[0]!.id, qty: '60' }] }), 200);
      expect((await postIssue(a.ws, bTooMuch.id)).status).toBe(200);
    });

    it('only one of two simultaneous issues against limited stock succeeds', async () => {
      const item = await createItem(w.admin, uniq('LIM'), { baseUnit: 'pc' });
      await stockUp(w, a, [{ itemId: item.id, qty: '100', unitPrice: '10' }]);
      const direct = () => a.wm.post('/v1/material-issues').send({ projectId: w.project.id, warehouseId: w.warehouse.id, remarks: 'Two crews, one pile', lines: [{ itemId: item.id, qty: '60' }] });
      const [first, second] = [await expectOk<Mi>(await direct(), 201), await expectOk<Mi>(await direct(), 201)];
      const results = await Promise.all([postIssue(a.wm, first.id), postIssue(a.wm, second.id)]);
      expect(results.map((r) => r.status).sort()).toEqual([200, 422]);
      expect(await stockOf(w.admin, item.id)).toMatchObject({ onHand: '40' });
      expect(await ctx.prisma.projectCostLedger.count({ where: { companyId: w.company.id, itemId: item.id as string } })).toBe(1);
      expect(await ctx.prisma.stockLedger.count({ where: { companyId: w.company.id, itemId: item.id as string, txnType: 'PROJECT_ISSUE' } })).toBe(1);
    });

    it('two approved requests reserving the same stock block each other instead of overdrawing it', async () => {
      const item = await createItem(w.admin, uniq('RSV'), { baseUnit: 'pc' });
      await stockUp(w, a, [{ itemId: item.id, qty: '100', unitPrice: '10' }]);
      const [c, d] = [await approvedMr(item.id as string, '60'), await approvedMr(item.id as string, '60')];
      const [ic, id] = [await expectOk<Mi>(await issueFrom(a.ws, c.id as string), 201), await expectOk<Mi>(await issueFrom(a.ws, d.id as string), 201)];
      const results = await Promise.all([postIssue(a.ws, ic.id), postIssue(a.ws, id.id)]);
      expect(results.map((r) => r.status)).toEqual([422, 422]);
      expect(await stockOf(w.admin, item.id)).toMatchObject({ onHand: '100', reserved: '120' });
      expect(await ctx.prisma.stockLedger.count({ where: { companyId: w.company.id, itemId: item.id as string, txnType: 'PROJECT_ISSUE' } })).toBe(0);
    });

    it('reverses a posted issue: stock, project cost and request quantities come back', async () => {
      const item = await createItem(w.admin, uniq('REV'), { baseUnit: 'pc' });
      await stockUp(w, a, [{ itemId: item.id, qty: '20', unitPrice: '10' }]);
      const mr = await approvedMr(item.id as string, '10');
      const issue = await expectOk<Mi>(await issueFrom(a.ws, mr.id as string), 201);
      await postIssue(a.ws, issue.id);
      expect((await a.ws.post(`/v1/material-issues/${issue.id}/cancel`).set('Idempotency-Key', idemKey()).send({ reason: 'Wrong tower' })).status).toBe(403);
      expect((await a.wm.post(`/v1/material-issues/${issue.id}/cancel`).set('Idempotency-Key', idemKey()).send({ reason: 'x' })).status).toBe(400);
      const res = await a.wm.post(`/v1/material-issues/${issue.id}/cancel`).set('Idempotency-Key', idemKey()).send({ reason: 'Issued to the wrong tower' });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('CANCELLED');
      expect(await stockOf(w.admin, item.id)).toMatchObject({ onHand: '20', value: '200' });
      const cost = await ctx.prisma.projectCostLedger.aggregate({ where: { companyId: w.company.id, itemId: item.id as string }, _sum: { totalCost: true } });
      expect(cost._sum.totalCost?.toString()).toBe('0');
      expect(await ctx.prisma.projectCostLedger.count({ where: { companyId: w.company.id, itemId: item.id as string } })).toBe(2);
      expect((await w.pm.get(`/v1/material-requests/${mr.id}`)).body.lines[0]).toMatchObject({ issuedQty: '0', remainingQty: '10' });
      expect((await a.wm.post(`/v1/material-issues/${issue.id}/cancel`).set('Idempotency-Key', idemKey()).send({ reason: 'again please' })).status).toBe(422);
      // and the request can be issued again
      const again = await expectOk<Mi>(await issueFrom(a.ws, mr.id as string), 201);
      expect((await postIssue(a.ws, again.id)).status).toBe(200);
    });

    it('direct issue needs the override permission and a reason', async () => {
      const item = await createItem(w.admin, uniq('DIR'), { baseUnit: 'pc' });
      await stockUp(w, a, [{ itemId: item.id, qty: '10', unitPrice: '20' }]);
      const body = { projectId: w.project.id, warehouseId: w.warehouse.id, remarks: 'Emergency formwork repair', lines: [{ itemId: item.id, qty: '3', wbsNodeId: dims.wbs.id, costCodeId: dims.costCode.id }] };
      expect((await a.ws.post('/v1/material-issues').send(body)).status).toBe(403);
      expect((await a.wm.post('/v1/material-issues').send({ ...body, remarks: undefined })).status).toBe(400);
      expect((await a.wm.post('/v1/material-issues').send({ ...body, lines: [{ itemId: item.id, qty: '3', wbsNodeId: (await projectDims(w, w.otherProject.id)).wbs.id }] })).status).toBe(422);
      const draft = await expectOk<Mi>(await a.wm.post('/v1/material-issues').send(body), 201);
      expect((await a.ws.post(`/v1/material-issues/${draft.id}/post`).set('Idempotency-Key', idemKey()).send({})).status).toBe(403);
      const posted = await postIssue(a.wm, draft.id);
      expect(posted.body).toMatchObject({ status: 'POSTED', totalCost: '60', request: null });
      const cost = await ctx.prisma.projectCostLedger.findFirstOrThrow({ where: { companyId: w.company.id, sourceId: draft.id } });
      expect(cost).toMatchObject({ wbsNodeId: dims.wbs.id, costCodeId: dims.costCode.id, boqItemId: null });
      const trail = await a.wm.get(`/v1/material-issues/${draft.id}/activity`);
      expect(trail.body.find((t: { action: string }) => t.action === 'POST')).toMatchObject({ reason: 'Emergency formwork repair' });
    });

    it('cannot issue more than is in stock, to a closed project, or across companies/projects', async () => {
      const item = await createItem(w.admin, uniq('SCP'), { baseUnit: 'pc' });
      await stockUp(w, a, [{ itemId: item.id, qty: '5', unitPrice: '10' }]);
      const direct = (qty: string) => ({ projectId: w.project.id, warehouseId: w.warehouse.id, remarks: 'Needed now', lines: [{ itemId: item.id, qty }] });
      const over = await expectOk<Mi>(await a.wm.post('/v1/material-issues').send(direct('9')), 201);
      const res = await postIssue(a.wm, over.id);
      expect(res.status).toBe(422);
      expect(res.body.detail).toMatch(/Insufficient stock/);

      const ok = await expectOk<Mi>(await a.wm.post('/v1/material-issues').send(direct('1')), 201);
      expect((await rival.admin.get(`/v1/material-issues/${ok.id}`)).status).toBe(404);
      expect((await rival.admin.post(`/v1/material-issues/${ok.id}/post`).set('Idempotency-Key', idemKey()).send({})).status).toBe(404);
      expect((await rival.admin.get('/v1/material-issues')).body.items).toHaveLength(0);
      const scoped = await userAgent(w, ['Warehouse Manager'], { projectId: w.otherProject.id });
      expect((await scoped.agent.get(`/v1/material-issues/${ok.id}`)).status).toBe(403);
      expect((await scoped.agent.post('/v1/material-issues').send(direct('1'))).status).toBe(403);
      const whScoped = await userAgent(w, ['Warehouse Manager'], { warehouseId: (await createWarehouse(ctx.prisma, w.company, uniq('XW'))).id });
      expect((await whScoped.agent.post(`/v1/material-issues/${ok.id}/post`).set('Idempotency-Key', idemKey()).send({})).status).toBe(403);

      const closed = await buildWorld(ctx, 'MatClosed');
      const ca = await stockActors(closed);
      const citem = await createItem(closed.admin, uniq('CL'), { baseUnit: 'pc' });
      await stockUp(closed, ca, [{ itemId: citem.id, qty: '5', unitPrice: '10' }]);
      const cd = await ca.wm.post('/v1/material-issues').send({ projectId: closed.project.id, warehouseId: closed.warehouse.id, remarks: 'Before closing', lines: [{ itemId: citem.id, qty: '1' }] });
      await ctx.prisma.project.update({ where: { id: closed.project.id }, data: { status: 'ON_HOLD' } });
      const blocked = await postIssue(ca.wm, cd.body.id);
      expect(blocked.status).toBe(422);
      expect(blocked.body.detail).toMatch(/requires an ACTIVE project/);
    });

    it('issues FEFO: soonest expiry first, never expired stock', async () => {
      batchItem = await createItem(w.admin, uniq('FEFO'), { baseUnit: 'kg', trackBatch: true, trackExpiry: true });
      await stockUp(w, a, [{ itemId: batchItem.id, qty: '30', unitPrice: '10', batchNo: 'LATE', expiryDate: '2027-09-30' }]);
      await stockUp(w, a, [{ itemId: batchItem.id, qty: '30', unitPrice: '12', batchNo: 'SOON', expiryDate: '2026-12-31' }]);
      await stockUp(w, a, [{ itemId: batchItem.id, qty: '50', unitPrice: '1', batchNo: 'EXPIRED', expiryDate: '2026-01-31' }]);
      const body = (qty: string) => ({ projectId: w.project.id, warehouseId: w.warehouse.id, remarks: 'FEFO test', lines: [{ itemId: batchItem.id, qty }] });
      const draft = await expectOk<Mi>(await a.wm.post('/v1/material-issues').send(body('40')), 201);
      const posted = await postIssue(a.wm, draft.id);
      expect(posted.status).toBe(200);
      expect(posted.body.lines.map((l: { batchNo: string; qty: string; unitCost: string }) => [l.batchNo, l.qty, l.unitCost])).toEqual([['SOON', '30', '12'], ['LATE', '10', '10']]);
      expect(posted.body.totalCost).toBe('460');
      // 20 usable left; the expired batch is never touched
      const more = await expectOk<Mi>(await a.wm.post('/v1/material-issues').send(body('21')), 201);
      const short = await postIssue(a.wm, more.id);
      expect(short.status).toBe(422);
      expect(short.body.detail).toMatch(/expired and excluded/);
      // an explicitly named expired batch is refused too
      const named = await expectOk<Mi>(await a.wm.post('/v1/material-issues').send({ ...body('1'), lines: [{ itemId: batchItem.id, qty: '1', batchNo: 'EXPIRED' }] }), 201);
      expect((await postIssue(a.wm, named.id)).body.detail).toMatch(/has expired/);
    });

    it('issues serialized items one serial per unit and restores them on reversal', async () => {
      const item = await createItem(w.admin, uniq('SRL'), { baseUnit: 'pc', trackSerial: true, itemType: 'SERIALIZED' });
      await stockUp(w, a, [{ itemId: item.id, qty: '3', unitPrice: '1000', serialNos: ['T-1', 'T-2', 'T-3'] }]);
      const draft = await expectOk<Mi>(await a.wm.post('/v1/material-issues').send({ projectId: w.project.id, warehouseId: w.warehouse.id, remarks: 'Tools to site', lines: [{ itemId: item.id, qty: '2' }] }), 201);
      const posted = await postIssue(a.wm, draft.id);
      expect(posted.body.lines.map((l: { serialNo: string }) => l.serialNo)).toEqual(['T-1', 'T-2']);
      expect(posted.body.totalCost).toBe('2000');
      const units = await ctx.prisma.serialUnit.findMany({ where: { companyId: w.company.id, itemId: item.id as string }, orderBy: { serialNo: 'asc' } });
      expect(units.map((u) => [u.serialNo, u.status])).toEqual([['T-1', 'ISSUED'], ['T-2', 'ISSUED'], ['T-3', 'IN_STOCK']]);
      const toolTooMany = await expectOk<Mi>(await a.wm.post('/v1/material-issues').send({ projectId: w.project.id, warehouseId: w.warehouse.id, remarks: 'More tools', lines: [{ itemId: item.id, qty: '2' }] }), 201);
      expect((await postIssue(a.wm, toolTooMany.id)).status).toBe(422);
      await expectOk(await a.wm.post(`/v1/material-issues/${draft.id}/cancel`).set('Idempotency-Key', idemKey()).send({ reason: 'Tools stayed in the yard' }), 200);
      expect((await ctx.prisma.serialUnit.count({ where: { companyId: w.company.id, itemId: item.id as string, status: 'IN_STOCK' } }))).toBe(3);
    });

    it('lists and filters issues', async () => {
      const page = await a.wm.get('/v1/material-issues').query({ limit: 2, status: 'POSTED' });
      expect(page.body.items).toHaveLength(2);
      expect(page.body.nextCursor).toBeTruthy();
      expect((await a.wm.get('/v1/material-issues').query({ projectId: w.project.id, sort: 'totalCost:desc' })).status).toBe(200);
      expect((await a.wm.get('/v1/material-issues').query({ sort: 'nope:desc' })).status).toBe(400);
    });
  });

  describe('material return', () => {
    it('returns good, damaged and quarantined material at the issue cost and credits the project', async () => {
      const item = await createItem(w.admin, uniq('RTN'), { baseUnit: 'pc' });
      await stockUp(w, a, [{ itemId: item.id, qty: '50', unitPrice: '30' }]);
      const mr = await approvedMr(item.id as string, '20');
      const issue = await expectOk<Mi>(await issueFrom(a.ws, mr.id as string), 201);
      const issued = (await postIssue(a.ws, issue.id)).body as Mi;
      const issueLine = issued.lines[0] as Json;
      expect(issued.totalCost).toBe('600');
      expect(await stockOf(w.admin, item.id)).toMatchObject({ onHand: '30' });

      expect((await a.ws.post('/v1/material-returns').send({ issueId: issue.id, reason: 'Surplus', lines: [{ issueLineId: issueLine.id, qty: '21', condition: 'GOOD' }] })).status).toBe(422);
      expect((await a.ws.post('/v1/material-returns').send({ issueId: issue.id, reason: 'Surplus', lines: [{ issueLineId: '00000000-0000-4000-8000-000000000000', qty: '1', condition: 'GOOD' }] })).status).toBe(422);
      expect((await a.ws.post('/v1/material-returns').send({ issueId: issue.id, lines: [{ issueLineId: issueLine.id, qty: '1', condition: 'GOOD' }] })).status).toBe(400);
      expect((await w.finance.post('/v1/material-returns').send({ issueId: issue.id, reason: 'Surplus', lines: [{ issueLineId: issueLine.id, qty: '1', condition: 'GOOD' }] })).status).toBe(403);
      expect((await rival.admin.post('/v1/material-returns').send({ issueId: issue.id, reason: 'Surplus', lines: [{ issueLineId: issueLine.id, qty: '1', condition: 'GOOD' }] })).status).toBe(404);

      const ret = await expectOk<Json & { lines: Json[] }>(
        await a.ws.post('/v1/material-returns').send({
          issueId: issue.id, reason: 'Surplus after the pour',
          lines: [{ issueLineId: issueLine.id, qty: '5', condition: 'GOOD' }, { issueLineId: issueLine.id, qty: '3', condition: 'DAMAGED' }, { issueLineId: issueLine.id, qty: '2', condition: 'QUARANTINE' }],
        }),
        201,
      );
      expect(ret).toMatchObject({ status: 'DRAFT', totalCost: '300' });
      const key = idemKey('ret');
      const posted = await a.ws.post(`/v1/material-returns/${ret.id}/post`).set('Idempotency-Key', key).send({});
      expect(posted.status).toBe(200);
      expect(posted.body.status).toBe('POSTED');
      expect((await a.ws.post(`/v1/material-returns/${ret.id}/post`).set('Idempotency-Key', key).send({})).headers['idempotent-replayed']).toBe('true');
      expect((await a.ws.post(`/v1/material-returns/${ret.id}/post`).set('Idempotency-Key', idemKey()).send({})).status).toBe(422);

      // only GOOD goods are available; the others are held in their own status
      expect(await stockOf(w.admin, item.id)).toMatchObject({ onHand: '35' });
      const summary = (await w.admin.get(`/v1/items/${item.id}/stock`)).body.warehouses[0];
      expect(summary).toMatchObject({ onHand: '35', damaged: '3', quarantine: '2' });
      // negative cost entries net the project cost down by the returned share
      const costs = await ctx.prisma.projectCostLedger.findMany({ where: { companyId: w.company.id, itemId: item.id as string }, orderBy: { createdAt: 'asc' } });
      expect(costs.filter((c) => c.txnType === 'MATERIAL_RETURN').map((c) => c.totalCost.toString()).sort()).toEqual(['-150', '-60', '-90']);
      expect(costs.reduce((s, c) => s.plus(c.totalCost), (costs[0]!.totalCost).minus(costs[0]!.totalCost)).toString()).toBe('300');
      // 10 of 20 are back; at most 10 more can be returned, and the issue cannot be reversed while returns stand
      expect((await a.ws.post('/v1/material-returns').send({ issueId: issue.id, reason: 'More', lines: [{ issueLineId: issueLine.id, qty: '11', condition: 'GOOD' }] })).status).toBe(422);
      const blocked = await a.wm.post(`/v1/material-issues/${issue.id}/cancel`).set('Idempotency-Key', idemKey()).send({ reason: 'Wrong tower' });
      expect(blocked.status).toBe(422);
      expect(blocked.body.detail).toMatch(/cancel the returns first/);
      // cancelling the return reverses stock and cost
      const cancelled = await a.wm.post(`/v1/material-returns/${ret.id}/cancel`).set('Idempotency-Key', idemKey()).send({ reason: 'Counted twice' });
      expect(cancelled.body.status).toBe('CANCELLED');
      expect(await stockOf(w.admin, item.id)).toMatchObject({ onHand: '30' });
      const net = await ctx.prisma.projectCostLedger.aggregate({ where: { companyId: w.company.id, itemId: item.id as string }, _sum: { totalCost: true } });
      expect(net._sum.totalCost?.toString()).toBe('600');
      const list = await a.wm.get('/v1/material-returns').query({ issueId: issue.id });
      expect(list.body.items).toHaveLength(1);
    });

    it('serialized returns restore the unit; a draft return can be cancelled', async () => {
      const item = await createItem(w.admin, uniq('SRT'), { baseUnit: 'pc', trackSerial: true, itemType: 'SERIALIZED' });
      await stockUp(w, a, [{ itemId: item.id, qty: '2', unitPrice: '500', serialNos: ['R-1', 'R-2'] }]);
      const draft = await expectOk<Mi>(await a.wm.post('/v1/material-issues').send({ projectId: w.project.id, warehouseId: w.warehouse.id, remarks: 'Drill to site', lines: [{ itemId: item.id, qty: '1' }] }), 201);
      const issued = (await postIssue(a.wm, draft.id)).body as Mi;
      const ret = await expectOk<Json>(await a.wm.post('/v1/material-returns').send({ issueId: draft.id, reason: 'Job done', lines: [{ issueLineId: issued.lines[0]!.id, qty: '1', condition: 'GOOD' }] }), 201);
      await expectOk(await a.wm.post(`/v1/material-returns/${ret.id}/post`).set('Idempotency-Key', idemKey()).send({}), 200);
      expect((await ctx.prisma.serialUnit.findFirstOrThrow({ where: { companyId: w.company.id, itemId: item.id as string, serialNo: 'R-1' } })).status).toBe('IN_STOCK');
      const second = await a.wm.post('/v1/material-returns').send({ issueId: draft.id, reason: 'Again', lines: [{ issueLineId: issued.lines[0]!.id, qty: '1', condition: 'GOOD' }] });
      expect(second.status).toBe(422);
      const spare = await expectOk<Mi>(await a.wm.post('/v1/material-issues').send({ projectId: w.project.id, warehouseId: w.warehouse.id, remarks: 'Second drill', lines: [{ itemId: item.id, qty: '1' }] }), 201);
      const spareIssued = (await postIssue(a.wm, spare.id)).body as Mi;
      const draftReturn = await expectOk<Json>(await a.wm.post('/v1/material-returns').send({ issueId: spare.id, reason: 'Changed mind', lines: [{ issueLineId: spareIssued.lines[0]!.id, qty: '1', condition: 'DAMAGED' }] }), 201);
      expect((await a.wm.post(`/v1/material-returns/${draftReturn.id}/cancel`).set('Idempotency-Key', idemKey()).send({ reason: 'Not returning it' })).body.status).toBe('CANCELLED');
      expect((await a.wm.post(`/v1/material-returns/${draftReturn.id}/post`).set('Idempotency-Key', idemKey()).send({})).status).toBe(422);
    });
  });

  describe('project cost', () => {
    it('reports budget vs committed vs actual by cost code from real aggregates', async () => {
      const buyItem = await createItem(w.admin, uniq('BVA'), { baseUnit: 'pc' });
      // 10 x 100 on an open PO against the BOQ cost code: committed until it is received
      const pr = await expectOk<Json & { lines: Json[] }>(await w.engineer.post('/v1/requisitions').send({ projectId: w.project.id, warehouseId: w.warehouse.id, lines: [{ itemId: buyItem.id, qty: '10', costCodeId: dims.costCode.id, wbsNodeId: dims.wbs.id }] }), 201);
      await w.engineer.post(`/v1/requisitions/${pr.id}/submit`).set('Idempotency-Key', idemKey()).send({});
      const po = await expectOk<Json & { lines: Json[] }>(await w.buyer.post('/v1/purchase-orders').set('Idempotency-Key', idemKey()).send({ source: 'REQUISITION', requisitionId: pr.id, supplierId: (await expectOk<Json>(await w.admin.post('/v1/suppliers').send({ code: uniq('S'), name: 'BVA Supplier' }))).id, lines: [{ requisitionLineId: pr.lines[0]!.id, qty: '10', unitPrice: '100' }] }), 201);
      await w.buyer.post(`/v1/purchase-orders/${po.id}/submit`).set('Idempotency-Key', idemKey()).send({});

      const before = await w.admin.get(`/v1/projects/${w.project.id}/budget-vs-actual`);
      expect(before.status).toBe(200);
      const row = before.body.lines.find((l: { costCode: { id: string } | null }) => l.costCode?.id === dims.costCode.id);
      expect(row).toMatchObject({ budget: '10000.00', unbudgeted: false });
      expect(Number(row.committed)).toBeGreaterThanOrEqual(1000);
      const actualBefore = Number(row.actual);

      const detail = (await w.buyer.get(`/v1/purchase-orders/${po.id}`)).body as Json & { status: string; lines: Json[] };
      expect(detail.status).toBe('APPROVED');
      await expectOk(await a.wm.post('/v1/goods-receipts').send({ orderId: po.id, lines: [{ orderLineId: detail.lines[0]!.id, receivedQty: '10' }] }), 201).then((g) =>
        a.wm.post(`/v1/goods-receipts/${g.id}/post`).set('Idempotency-Key', idemKey()).send({}),
      );
      const received = (await w.admin.get(`/v1/projects/${w.project.id}/budget-vs-actual`)).body.lines.find((l: { costCode: { id: string } | null }) => l.costCode?.id === dims.costCode.id);
      expect(Number(received.committed)).toBeLessThanOrEqual(Number(row.committed) - 1000);
      // receiving is inventory, not cost
      expect(Number(received.actual)).toBe(actualBefore);

      const draft = await expectOk<Mi>(await a.wm.post('/v1/material-issues').send({ projectId: w.project.id, warehouseId: w.warehouse.id, remarks: 'Cost check', lines: [{ itemId: buyItem.id, qty: '4', costCodeId: dims.costCode.id, wbsNodeId: dims.wbs.id }] }), 201);
      await postIssue(a.wm, draft.id);
      const issued = (await w.admin.get(`/v1/projects/${w.project.id}/budget-vs-actual`)).body;
      const after = issued.lines.find((l: { costCode: { id: string } | null }) => l.costCode?.id === dims.costCode.id);
      expect(Number(after.actual)).toBe(actualBefore + 400);
      expect(after.variance).toBe((10000 - Number(after.committed) - Number(after.actual)).toFixed(2));
      const sum = await ctx.prisma.projectCostLedger.aggregate({ where: { companyId: w.company.id, projectId: w.project.id }, _sum: { totalCost: true } });
      expect(Number(issued.totals.actual)).toBe(Number(sum._sum.totalCost));
      const dash = (await w.admin.get(`/v1/projects/${w.project.id}/dashboard`)).body.financial;
      expect(dash.actual).toBe(Number(sum._sum.totalCost).toFixed(2));
    });

    it('material cost counts only material issues less returns, never other project cost', async () => {
      const url = `/v1/projects/${w.project.id}/material-cost`;
      const read = async () => (await expectOk<Json>(await w.admin.get(url), 200)) as Json & { issued: string; returned: string; actual: string; lines: Array<Json & { costCode: { id: string } | null }> };
      const before = await read();

      const item = await createItem(w.admin, uniq('MCO'), { baseUnit: 'pc' });
      await stockUp(w, a, [{ itemId: item.id, qty: '20', unitPrice: '10' }]);
      const mr = await approvedMr(item.id as string, '10');
      const issue = await expectOk<Mi>(await issueFrom(a.ws, mr.id as string), 201);
      const issued = (await postIssue(a.ws, issue.id)).body as Mi;
      const afterIssue = await read();
      expect(Number(afterIssue.issued) - Number(before.issued)).toBe(100);
      expect(Number(afterIssue.actual) - Number(before.actual)).toBe(100);

      // spend that is not material is part of total project cost but must not appear here
      const user = await ctx.prisma.user.findFirstOrThrow({ where: { companyId: w.company.id } });
      await ctx.prisma.projectCostLedger.create({
        data: { companyId: w.company.id, projectId: w.project.id, costCodeId: dims.costCode.id, costCategory: 'LABOR', txnType: 'PAYROLL', txnDate: new Date(), totalCost: '7777', sourceType: 'TEST', sourceId: uniq('payroll'), userId: user.id },
      });
      expect((await read()).actual).toBe(afterIssue.actual);

      const ret = await expectOk<Json>(
        await a.ws.post('/v1/material-returns').send({ issueId: issue.id, reason: 'Surplus', lines: [{ issueLineId: (issued.lines[0] as Json).id, qty: '4', condition: 'GOOD' }] }),
        201,
      );
      await expectOk(await a.ws.post(`/v1/material-returns/${ret.id}/post`).set('Idempotency-Key', idemKey()).send({}), 200);
      const afterReturn = await read();
      expect(Number(afterReturn.returned) - Number(before.returned)).toBe(40);
      expect(Number(afterReturn.actual) - Number(before.actual)).toBe(60);
      const row = afterReturn.lines.find((l) => l.costCode?.id === dims.costCode.id) as Json & { issued: string; returned: string; actual: string };
      expect(Number(row.actual)).toBe(Number(row.issued) - Number(row.returned));

      // total project cost keeps the payroll row, so the two figures differ
      const total = (await w.admin.get(`/v1/projects/${w.project.id}/budget-vs-actual`)).body.totals.actual;
      expect(Number(total)).toBeGreaterThanOrEqual(Number(afterReturn.actual) + 7777);

      await expectOk(await a.wm.post(`/v1/material-returns/${ret.id}/cancel`).set('Idempotency-Key', idemKey()).send({ reason: 'Counted twice' }), 200);
      expect((await read()).actual).toBe(afterIssue.actual);

      expect((await ctx.http().get(url)).status).toBe(401);
      expect((await rival.admin.get(url)).status).toBe(404);
      expect((await w.viewer.get(url)).status).toBe(403);
    });

    it('is permission- and tenant-scoped', async () => {
      expect((await ctx.http().get(`/v1/projects/${w.project.id}/budget-vs-actual`)).status).toBe(401);
      expect((await rival.admin.get(`/v1/projects/${w.project.id}/budget-vs-actual`)).status).toBe(404);
      expect((await w.viewer.get(`/v1/projects/${w.project.id}/budget-vs-actual`)).status).toBe(403);
      expect((await site.get(`/v1/projects/${w.project.id}/budget-vs-actual`)).status).toBe(403);
    });
  });
});
