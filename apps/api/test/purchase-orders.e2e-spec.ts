import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startApp, stopApp, TestContext } from './support/app';
import { Agent, buildWorld, createItem, createSupplier, expectOk, idemKey, Json, setWorkflow, uniq, userAgent, World } from './support/world';

const daysFromNow = (n: number): string => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

describe('Purchase order', () => {
  let ctx: TestContext;
  let w: World;
  let foreign: World;
  let cement: Json;
  let rebar: Json;
  let supplier: Json;
  let adminUser: { id: string; agent: Agent };

  beforeAll(async () => {
    ctx = await startApp();
    w = await buildWorld(ctx, 'PO');
    foreign = await buildWorld(ctx, 'POX');
    await setWorkflow(w.admin, 'PURCHASE_REQUISITION', [{ minAmount: '0', steps: ['Project Manager'] }]);
    // <= 100,000: Finance. Above: Finance, then Company Admin.
    await setWorkflow(w.admin, 'PURCHASE_ORDER', [
      { minAmount: '0', maxAmount: '100000', steps: ['Finance'] },
      { minAmount: '100000.01', steps: ['Finance', 'Company Admin'] },
    ]);
    supplier = await createSupplier(w.admin, uniq('SUP'), { name: 'Holcim Philippines', paymentTermsDays: 30 });
    cement = await createItem(w.admin, uniq('CEM'), { baseUnit: 'bag' });
    rebar = await createItem(w.admin, uniq('RB'), { baseUnit: 'pc' });
    adminUser = { id: w.users.admin, agent: w.admin };
  });
  afterAll(() => stopApp(ctx));

  const approvedPr = async (lines: Array<Record<string, unknown>> = [{ itemId: cement.id, qty: '100' }, { itemId: rebar.id, qty: '50' }], extra: Record<string, unknown> = {}): Promise<Json> => {
    const pr = await expectOk<Json>(await w.engineer.post('/v1/requisitions').send({ projectId: w.project.id, warehouseId: w.warehouse.id, lines, ...extra }));
    await expectOk(await w.engineer.post(`/v1/requisitions/${pr.id}/submit`).set('Idempotency-Key', idemKey()).send({}));
    await expectOk(await w.pm.post(`/v1/requisitions/${pr.id}/approve`).set('Idempotency-Key', idemKey()).send({}));
    return pr;
  };
  const poBody = (pr: Json, lines: Array<Record<string, unknown>>, extra: Record<string, unknown> = {}) => ({
    source: 'REQUISITION', requisitionId: pr.id, supplierId: supplier.id, lines, ...extra,
  });
  const prLine = (pr: Json, i: number): string => (pr.lines as Json[])[i]!.id;
  const placePo = (body: Record<string, unknown>, agent: Agent = w.buyer, key = idemKey('po')) => agent.post('/v1/purchase-orders').set('Idempotency-Key', key).send(body);
  /** A draft PO for 40 bags and 20 bars against a fresh 100/50 requisition. */
  const draftPo = async (extra: Record<string, unknown> = {}): Promise<{ pr: Json; po: Json }> => {
    const pr = await approvedPr();
    const po = await expectOk<Json>(
      await placePo(poBody(pr, [
        { requisitionLineId: prLine(pr, 0), qty: '40', unitPrice: '250', discountPct: '5', taxPct: '12', deliveryDate: daysFromNow(10) },
        { requisitionLineId: prLine(pr, 1), qty: '20', unitPrice: '130.5', taxPct: '12', deliveryDate: daysFromNow(14) },
      ], { freight: '200.50', ...extra })),
    );
    return { pr, po };
  };
  const submitPo = (id: string, agent: Agent = w.buyer, key = idemKey('sub')) => agent.post(`/v1/purchase-orders/${id}/submit`).set('Idempotency-Key', key).send({});
  const approvePo = (id: string, agent: Agent = w.finance, key = idemKey('apr')) => agent.post(`/v1/purchase-orders/${id}/approve`).set('Idempotency-Key', key).send({});
  const approvedPo = async (): Promise<{ pr: Json; po: Json }> => {
    const made = await draftPo();
    await expectOk(await submitPo(made.po.id));
    const po = await expectOk<Json>(await approvePo(made.po.id));
    return { pr: made.pr, po };
  };
  const prState = async (id: string) => {
    const pr = await ctx.prisma.purchaseRequisition.findUniqueOrThrow({ where: { id }, include: { lines: { orderBy: { lineNo: 'asc' } } } });
    return { status: pr.status, ordered: pr.lines.map((l) => l.orderedQty.toString()) };
  };

  describe('create from requisition lines', () => {
    it('creates a draft with server-computed totals and tracks the ordered quantity on the requisition', async () => {
      const pr = await approvedPr();
      const res = await placePo(
        poBody(pr, [
          { requisitionLineId: prLine(pr, 0), qty: '40', unitPrice: '250', discountPct: '5', taxPct: '12', deliveryDate: daysFromNow(10) },
          { requisitionLineId: prLine(pr, 1), qty: '20', unitPrice: '130.5', taxPct: '12', deliveryDate: daysFromNow(14), description: '16mm bars' },
        ], { freight: '200.50', paymentTerms: '30 days PDC', deliveryLocation: 'Site gate 2', terms: 'LDs apply' }),
      );
      expect(res.status).toBe(201);
      expect(res.body.number).toMatch(/^PO-\d{4}-\d{5}$/);
      // Line 1: gross 10000, discount 500, net 9500, tax 1140. Line 2: gross 2610, tax 313.20.
      expect(res.body).toMatchObject({
        status: 'DRAFT', supplier: { id: supplier.id }, project: { id: w.project.id }, warehouse: { id: w.warehouse.id }, requisition: { id: pr.id },
        subtotal: '12610', discount: '500', taxAmount: '1453.2', freight: '200.5', totalAmount: '13763.7', currency: 'PHP',
        paymentTerms: '30 days PDC', deliveryLocation: 'Site gate 2', createdById: w.users.buyer, receipts: [], quotationId: null,
      });
      const [a, b] = res.body.lines as Json[];
      expect(a).toMatchObject({ lineNo: 1, qty: '40', unit: 'bag', unitPrice: '250', discountPct: '5', discountAmount: '500', lineTotal: '9500', taxAmount: '1140', openQty: '40', cancelledQty: '0', receivedQty: '0', requisitionLineId: prLine(pr, 0) });
      expect(b).toMatchObject({ lineTotal: '2610', taxAmount: '313.2', description: '16mm bars' });
      expect(res.body.expectedDate).toContain(daysFromNow(14));
      expect(await prState(pr.id)).toEqual({ status: 'PARTIALLY_ORDERED', ordered: ['40', '20'] });
      const reread = await w.buyer.get(`/v1/requisitions/${pr.id}`);
      expect((reread.body.lines as Json[]).map((l) => l.remainingQty)).toEqual(['60', '30']);
      expect(reread.body.purchaseOrders).toEqual([expect.objectContaining({ id: res.body.id })]);
    });

    it('rounds money half-up per line and keeps the header equal to the sum of its lines', async () => {
      const pr = await approvedPr([{ itemId: cement.id, qty: '3' }]);
      const res = await placePo(poBody(pr, [{ requisitionLineId: prLine(pr, 0), qty: '3', unitPrice: '0.335', taxPct: '12' }], { freight: '0.01' }));
      // gross 1.005 -> 1.01 ; tax 1.01 x 12% = 0.1212 -> 0.12 ; freight 0.01 ; total 1.14
      expect(res.body).toMatchObject({ subtotal: '1.01', taxAmount: '0.12', freight: '0.01', totalAmount: '1.14' });
      expect((res.body.lines as Json[])[0]).toMatchObject({ lineTotal: '1.01', taxAmount: '0.12' });
    });

    it('orders the remainder across several POs and refuses to exceed the requisition quantity', async () => {
      const pr = await approvedPr([{ itemId: cement.id, qty: '100' }]);
      const line = prLine(pr, 0);
      const order = (qty: string) => placePo(poBody(pr, [{ requisitionLineId: line, qty, unitPrice: '250' }]));
      expect((await order('60')).status).toBe(201);
      expect(await prState(pr.id)).toEqual({ status: 'PARTIALLY_ORDERED', ordered: ['60'] });
      const over = await order('40.0001');
      expect(over.status).toBe(422);
      expect(JSON.stringify(over.body.errors)).toContain('Exceeds the remaining requisition quantity (40)');
      expect(await ctx.prisma.purchaseOrder.count({ where: { requisitionId: pr.id } })).toBe(1);
      expect(await prState(pr.id)).toEqual({ status: 'PARTIALLY_ORDERED', ordered: ['60'] });
      expect((await order('40')).status).toBe(201);
      expect(await prState(pr.id)).toEqual({ status: 'ORDERED', ordered: ['100'] });
      const more = await order('1');
      expect(more.status).toBe(422);
      expect(more.body.detail).toContain('approved requisition');
    });

    it('two POs competing for the same remaining quantity: exactly one wins and the total never exceeds the requisition', async () => {
      const pr = await approvedPr([{ itemId: cement.id, qty: '100' }]);
      const line = prLine(pr, 0);
      const attempt = () => placePo(poBody(pr, [{ requisitionLineId: line, qty: '70', unitPrice: '250' }]));
      const results = await Promise.all([attempt(), attempt(), attempt()]);
      expect(results.map((r) => r.status).sort()).toEqual([201, 422, 422]);
      expect(await prState(pr.id)).toEqual({ status: 'PARTIALLY_ORDERED', ordered: ['70'] });
      expect(await ctx.prisma.purchaseOrder.count({ where: { requisitionId: pr.id } })).toBe(1);
    });

    it('is idempotent: a retry with the same key returns the first PO and reserves quantity once', async () => {
      const pr = await approvedPr([{ itemId: cement.id, qty: '100' }]);
      const body = poBody(pr, [{ requisitionLineId: prLine(pr, 0), qty: '30', unitPrice: '250' }]);
      const key = idemKey('po');
      const first = await placePo(body, w.buyer, key);
      const retry = await placePo(body, w.buyer, key);
      expect(first.status).toBe(201);
      expect(retry.status).toBe(201);
      expect(retry.headers['idempotent-replayed']).toBe('true');
      expect(retry.body.id).toBe(first.body.id);
      expect(await ctx.prisma.purchaseOrder.count({ where: { requisitionId: pr.id } })).toBe(1);
      expect(await prState(pr.id)).toEqual({ status: 'PARTIALLY_ORDERED', ordered: ['30'] });
      const different = await placePo(poBody(pr, [{ requisitionLineId: prLine(pr, 0), qty: '31', unitPrice: '250' }]), w.buyer, key);
      expect(different.status).toBe(422);
      expect((await w.buyer.post('/v1/purchase-orders').send(body)).status).toBe(400);
    });

    it('validates input (400)', async () => {
      const pr = await approvedPr([{ itemId: cement.id, qty: '10' }]);
      const line = prLine(pr, 0);
      const good = { requisitionLineId: line, qty: '1', unitPrice: '1' };
      const bad: Array<Record<string, unknown>> = [
        { source: 'NOPE' },
        { source: 'QUOTATION' },
        poBody(pr, []),
        poBody(pr, [{ ...good, qty: '0' }]),
        poBody(pr, [{ ...good, unitPrice: '-1' }]),
        poBody(pr, [{ ...good, taxPct: '120' }]),
        poBody(pr, [good, good]),
        { ...poBody(pr, [good]), supplierId: undefined },
        { ...poBody(pr, [good]), freight: '1.234' },
        { source: 'QUOTATION', quotationId: pr.id, lines: [good] },
      ];
      for (const b of bad) expect((await placePo(b)).status, JSON.stringify(b)).toBe(400);
    });

    it('rejects foreign or unusable references and unusable requisitions (422)', async () => {
      const pr = await approvedPr([{ itemId: cement.id, qty: '10' }]);
      const good = [{ requisitionLineId: prLine(pr, 0), qty: '1', unitPrice: '1' }];
      const other = await approvedPr([{ itemId: cement.id, qty: '10' }]);
      const theirs = await createSupplier(foreign.admin);
      const inactive = await createSupplier(w.admin);
      await w.admin.patch(`/v1/suppliers/${inactive.id}`).send({ active: false });
      const theirWh = await foreign.admin.post('/v1/warehouses').send({ code: uniq('FW'), name: 'Foreign' });

      expect((await placePo(poBody(pr, good, { supplierId: theirs.id }))).status).toBe(422);
      expect((await placePo(poBody(pr, good, { supplierId: inactive.id }))).status).toBe(422);
      expect((await placePo(poBody(pr, good, { warehouseId: theirWh.body.id }))).status).toBe(422);
      expect((await placePo(poBody(pr, [{ requisitionLineId: prLine(other, 0), qty: '1', unitPrice: '1' }]))).status).toBe(422);
      expect((await placePo(poBody(pr, good), foreign.admin)).status).toBe(422);

      const draft = await expectOk<Json>(await w.engineer.post('/v1/requisitions').send({ projectId: w.project.id, warehouseId: w.warehouse.id, lines: [{ itemId: cement.id, qty: '5' }] }));
      expect((await placePo(poBody(draft, [{ requisitionLineId: prLine(draft, 0), qty: '1', unitPrice: '1' }]))).status).toBe(422);

      const noWarehouse = await approvedPr([{ itemId: cement.id, qty: '5' }], { warehouseId: null });
      const missing = await placePo(poBody(noWarehouse, [{ requisitionLineId: prLine(noWarehouse, 0), qty: '1', unitPrice: '1' }]));
      expect(missing.status).toBe(422);
      expect(JSON.stringify(missing.body.errors)).toContain('warehouseId');
      expect((await placePo(poBody(noWarehouse, [{ requisitionLineId: prLine(noWarehouse, 0), qty: '1', unitPrice: '1' }], { warehouseId: w.warehouse.id }))).status).toBe(201);

      await ctx.prisma.project.update({ where: { id: w.project.id }, data: { status: 'ON_HOLD' } });
      const held = await placePo(poBody(pr, good));
      await ctx.prisma.project.update({ where: { id: w.project.id }, data: { status: 'ACTIVE' } });
      expect(held.status).toBe(422);
    });

    it('requires authentication, permission, and respects company and project scope', async () => {
      const pr = await approvedPr([{ itemId: cement.id, qty: '10' }]);
      const body = poBody(pr, [{ requisitionLineId: prLine(pr, 0), qty: '1', unitPrice: '1' }]);
      expect((await ctx.http().post('/v1/purchase-orders').set('Idempotency-Key', idemKey()).send(body)).status).toBe(401);
      expect((await placePo(body, w.engineer)).status).toBe(403);
      expect((await placePo(body, w.viewer)).status).toBe(403);
      const wrongProject = await userAgent(w, ['Procurement'], { projectId: w.otherProject.id });
      expect((await placePo(body, wrongProject.agent)).status).toBe(403);
      expect(await ctx.prisma.purchaseOrder.count({ where: { requisitionId: pr.id } })).toBe(0);
    });
  });

  describe('create from an awarded quotation', () => {
    const awardedRfq = async (qty?: string) => {
      const pr = await approvedPr([{ itemId: cement.id, qty: '100' }, { itemId: rebar.id, qty: '50' }]);
      const rfq = await expectOk<Json>(await w.buyer.post('/v1/rfqs').send({
        requisitionId: pr.id, supplierIds: [supplier.id], dueDate: daysFromNow(7), lines: (pr.lines as Json[]).map((l) => ({ requisitionLineId: l.id })),
      }));
      await w.buyer.post(`/v1/rfqs/${rfq.id}/send`).send({});
      const rfqLines = (rfq.lines as Json[]).map((l) => l.id);
      const q = await expectOk<Json>(
        await w.buyer.post(`/v1/rfqs/${rfq.id}/quotations`).send({
          supplierId: supplier.id, quoteDate: '2026-10-01', validUntil: '2099-01-01', paymentTerms: '45 days', freight: '300', deliveryDays: 10,
          lines: [
            { rfqLineId: rfqLines[0], unitPrice: '245', discountPct: '2', taxPct: '12', ...(qty ? { qty } : {}) },
            { rfqLineId: rfqLines[1], unitPrice: '130', taxPct: '12', deliveryDate: daysFromNow(12) },
          ],
        }),
      );
      await w.buyer.post(`/v1/rfqs/${rfq.id}/award`).set('Idempotency-Key', idemKey()).send({ quotationId: q.id });
      return { pr, rfq, q };
    };

    it('copies supplier, prices, discount, tax, terms and freight from the awarded quotation', async () => {
      const { pr, rfq, q } = await awardedRfq();
      const res = await placePo({ source: 'QUOTATION', quotationId: q.id, deliveryLocation: 'Mactan site' });
      expect(res.status).toBe(201);
      // Line 1: gross 24500, discount 490, net 24010, tax 2881.20. Line 2: gross 6500, tax 780.
      expect(res.body).toMatchObject({
        supplier: { id: supplier.id }, quotationId: q.id, rfqId: rfq.id, requisition: { id: pr.id }, rfq: { id: rfq.id },
        paymentTerms: '45 days', freight: '300', subtotal: '31000', discount: '490', taxAmount: '3661.2', totalAmount: '34471.2', deliveryLocation: 'Mactan site',
      });
      expect((res.body.lines as Json[]).map((l) => [l.qty, l.unitPrice, l.lineTotal, l.quotationLineId !== null])).toEqual([['100', '245', '24010', true], ['50', '130', '6500', true]]);
      expect(await prState(pr.id)).toEqual({ status: 'ORDERED', ordered: ['100', '50'] });
    });

    it('orders only the quoted quantity when the supplier quoted less', async () => {
      const { pr, q } = await awardedRfq('60');
      const res = await placePo({ source: 'QUOTATION', quotationId: q.id });
      expect((res.body.lines as Json[])[0]).toMatchObject({ qty: '60' });
      expect(await prState(pr.id)).toEqual({ status: 'PARTIALLY_ORDERED', ordered: ['60', '50'] });
    });

    it('refuses a quotation that was not awarded, an RFQ that is not awarded, or one already fully ordered', async () => {
      const pr = await approvedPr([{ itemId: cement.id, qty: '10' }]);
      const rfq = await expectOk<Json>(await w.buyer.post('/v1/rfqs').send({
        requisitionId: pr.id, supplierIds: [supplier.id], dueDate: daysFromNow(7), lines: [{ requisitionLineId: prLine(pr, 0) }],
      }));
      await w.buyer.post(`/v1/rfqs/${rfq.id}/send`).send({});
      const q = await expectOk<Json>(await w.buyer.post(`/v1/rfqs/${rfq.id}/quotations`).send({
        supplierId: supplier.id, quoteDate: '2026-10-01', lines: [{ rfqLineId: (rfq.lines as Json[])[0]!.id, unitPrice: '10' }],
      }));
      const notAwarded = await placePo({ source: 'QUOTATION', quotationId: q.id });
      expect(notAwarded.status).toBe(422);
      expect(notAwarded.body.detail).toContain('awarded');

      const { q: awarded } = await awardedRfq();
      expect((await placePo({ source: 'QUOTATION', quotationId: awarded.id })).status).toBe(201);
      expect((await placePo({ source: 'QUOTATION', quotationId: awarded.id })).status).toBe(422);
      expect((await placePo({ source: 'QUOTATION', quotationId: awarded.id }, foreign.admin)).status).toBe(422);
    });
  });

  describe('edit a draft', () => {
    it('changes quantities, prices and header fields; totals and the reserved quantity follow', async () => {
      const { pr, po } = await draftPo();
      const [l1, l2] = po.lines as Json[];
      const res = await w.buyer.patch(`/v1/purchase-orders/${po.id}`).send({
        expectedDate: daysFromNow(30), paymentTerms: 'COD', freight: '0',
        lines: [{ id: l1!.id, qty: '50', unitPrice: '260', discountPct: '0' }, { id: l2!.id, qty: '10' }],
      });
      expect(res.status).toBe(200);
      // L1: 50 x 260 = 13000, tax 1560. L2: 10 x 130.5 = 1305, tax 156.60.
      expect(res.body).toMatchObject({ subtotal: '14305', discount: '0', taxAmount: '1716.6', freight: '0', totalAmount: '16021.6', paymentTerms: 'COD' });
      expect(await prState(pr.id)).toEqual({ status: 'PARTIALLY_ORDERED', ordered: ['50', '10'] });
    });

    it('removing a line releases its quantity; exceeding the remainder is refused and changes nothing', async () => {
      const { pr, po } = await draftPo();
      const [l1, l2] = po.lines as Json[];
      const over = await w.buyer.patch(`/v1/purchase-orders/${po.id}`).send({ lines: [{ id: l1!.id, qty: '101' }, { id: l2!.id }] });
      expect(over.status).toBe(422);
      expect(await prState(pr.id)).toEqual({ status: 'PARTIALLY_ORDERED', ordered: ['40', '20'] });
      expect((await w.buyer.get(`/v1/purchase-orders/${po.id}`)).body.totalAmount).toBe('13763.7');

      const removed = await w.buyer.patch(`/v1/purchase-orders/${po.id}`).send({ lines: [{ id: l1!.id }] });
      expect(removed.body.lines).toHaveLength(1);
      expect(removed.body).toMatchObject({ subtotal: '10000', totalAmount: '10840.5' });
      expect(await prState(pr.id)).toEqual({ status: 'PARTIALLY_ORDERED', ordered: ['40', '0'] });
    });

    it('validates the edit, line ownership, state and permission', async () => {
      const { po } = await draftPo();
      const other = await draftPo();
      const [l1] = po.lines as Json[];
      expect((await w.buyer.patch(`/v1/purchase-orders/${po.id}`).send({ lines: [] })).status).toBe(400);
      expect((await w.buyer.patch(`/v1/purchase-orders/${po.id}`).send({ lines: [{ id: l1!.id, qty: '-1' }] })).status).toBe(400);
      expect((await w.buyer.patch(`/v1/purchase-orders/${po.id}`).send({ lines: [{ id: l1!.id }, { id: l1!.id }] })).status).toBe(400);
      expect((await w.buyer.patch(`/v1/purchase-orders/${po.id}`).send({ lines: [{ id: (other.po.lines as Json[])[0]!.id }] })).status).toBe(422);
      expect((await w.engineer.patch(`/v1/purchase-orders/${po.id}`).send({ terms: 'x' })).status).toBe(403);
      expect((await foreign.admin.patch(`/v1/purchase-orders/${po.id}`).send({ terms: 'x' })).status).toBe(404);
      await submitPo(po.id);
      const late = await w.buyer.patch(`/v1/purchase-orders/${po.id}`).send({ terms: 'late' });
      expect(late.status).toBe(422);
    });
  });

  describe('submit, approve and reject', () => {
    it('submits into the PURCHASE_ORDER workflow, then Finance approves and the handler sets APPROVED', async () => {
      const { po } = await draftPo();
      const submitted = await submitPo(po.id);
      expect(submitted.status).toBe(200);
      expect(submitted.body).toMatchObject({ status: 'PENDING_APPROVAL', submittedAt: expect.any(String) });
      expect(submitted.body.approvals[0]).toMatchObject({ status: 'PENDING', totalSteps: 1, currentRole: 'Finance', amount: '13763.70' });
      const notified = await ctx.prisma.notification.findMany({ where: { entityId: po.id, type: 'APPROVAL_PENDING' } });
      expect(notified.map((n) => n.userId)).toContain(w.users.finance);

      const approved = await approvePo(po.id);
      expect(approved.status).toBe(200);
      expect(approved.body).toMatchObject({ status: 'APPROVED', approvedAt: expect.any(String) });
      expect(approved.body.approvals[0].steps[0]).toMatchObject({ state: 'APPROVED', role: 'Finance', decidedBy: { id: w.users.finance } });
      const result = await ctx.prisma.notification.findMany({ where: { entityId: po.id, type: 'APPROVAL_RESULT' } });
      expect(result.map((n) => n.userId)).toEqual([w.users.buyer]);
    });

    it('submit is idempotent and only valid for drafts with a positive total', async () => {
      const { po } = await draftPo();
      const key = idemKey('sub');
      const first = await submitPo(po.id, w.buyer, key);
      const retry = await submitPo(po.id, w.buyer, key);
      expect(retry.headers['idempotent-replayed']).toBe('true');
      expect(retry.body).toEqual(first.body);
      expect(await ctx.prisma.approvalRequest.count({ where: { documentId: po.id } })).toBe(1);
      expect((await submitPo(po.id)).status).toBe(422);
      expect((await w.buyer.post(`/v1/purchase-orders/${po.id}/submit`).send({})).status).toBe(400);

      const pr = await approvedPr([{ itemId: cement.id, qty: '10' }]);
      const free = await expectOk<Json>(await placePo(poBody(pr, [{ requisitionLineId: prLine(pr, 0), qty: '10', unitPrice: '0' }])));
      const res = await submitPo(free.id);
      expect(res.status).toBe(422);
      expect(res.body.detail).toContain('positive total');
      expect((await submitPo(po.id, w.viewer)).status).toBe(403);
    });

    it('needs both approval steps for a large order, in order, by the right roles', async () => {
      const pr = await approvedPr([{ itemId: cement.id, qty: '1000' }]);
      const po = await expectOk<Json>(await placePo(poBody(pr, [{ requisitionLineId: prLine(pr, 0), qty: '1000', unitPrice: '250', taxPct: '12' }])));
      expect(po.totalAmount).toBe('280000');
      expect((await submitPo(po.id)).body.approvals[0]).toMatchObject({ totalSteps: 2 });
      expect((await approvePo(po.id, adminUser.agent)).status).toBe(403);
      const step1 = await approvePo(po.id, w.finance);
      expect(step1.body.status).toBe('PENDING_APPROVAL');
      expect((await approvePo(po.id, w.finance)).status).toBe(403);
      const step2 = await approvePo(po.id, adminUser.agent);
      expect(step2.body).toMatchObject({ status: 'APPROVED' });
      expect(step2.body.approvals[0].steps.map((s: Json) => s.state)).toEqual(['APPROVED', 'APPROVED']);
    });

    it('enforces who may approve: not the requester, role, scope, company or anonymous', async () => {
      const { po } = await draftPo();
      await submitPo(po.id);
      expect((await approvePo(po.id, w.buyer)).status).toBe(403);
      expect((await approvePo(po.id, w.pm)).status).toBe(403);
      expect((await approvePo(po.id, w.viewer)).status).toBe(403);
      expect((await approvePo(po.id, foreign.admin)).status).toBe(404);
      expect((await ctx.http().post(`/v1/purchase-orders/${po.id}/approve`).set('Idempotency-Key', idemKey()).send({})).status).toBe(401);
      const wrongScope = await userAgent(w, ['Finance'], { projectId: w.otherProject.id });
      expect((await approvePo(po.id, wrongScope.agent)).status).toBe(403);
      expect((await ctx.prisma.purchaseOrder.findUniqueOrThrow({ where: { id: po.id } })).status).toBe('PENDING_APPROVAL');
      const rightScope = await userAgent(w, ['Finance'], { projectId: w.project.id });
      expect((await approvePo(po.id, rightScope.agent)).body.status).toBe('APPROVED');
    });

    it('approval is idempotent, cannot be repeated, and is race-safe', async () => {
      const { po } = await draftPo();
      await submitPo(po.id);
      const key = idemKey('apr');
      const first = await approvePo(po.id, w.finance, key);
      const retry = await approvePo(po.id, w.finance, key);
      expect(retry.headers['idempotent-replayed']).toBe('true');
      expect(retry.body).toEqual(first.body);
      expect((await approvePo(po.id)).status).toBe(422);

      const racing = await draftPo();
      await submitPo(racing.po.id);
      const otherFinance = await userAgent(w, ['Finance']);
      const [a, b] = await Promise.all([approvePo(racing.po.id, w.finance), approvePo(racing.po.id, otherFinance.agent)]);
      expect([a.status, b.status].sort()).toEqual([200, 422]);
      expect(await ctx.prisma.approvalAction.count({ where: { request: { documentId: racing.po.id } } })).toBe(1);
    });

    it('rejects with a comment, ends REJECTED and releases the requisition quantity', async () => {
      const { pr, po } = await draftPo();
      await submitPo(po.id);
      expect(await prState(pr.id)).toEqual({ status: 'PARTIALLY_ORDERED', ordered: ['40', '20'] });
      const reject = (comment?: string) => w.finance.post(`/v1/purchase-orders/${po.id}/reject`).set('Idempotency-Key', idemKey('rej')).send(comment ? { comment } : {});
      expect((await reject()).status).toBe(400);
      const res = await reject('Prices not competitive');
      expect(res.body).toMatchObject({ status: 'REJECTED', rejectedAt: expect.any(String) });
      expect(res.body.lines.map((l: Json) => [l.cancelledQty, l.openQty])).toEqual([['40', '0'], ['20', '0']]);
      expect(await prState(pr.id)).toEqual({ status: 'APPROVED', ordered: ['0', '0'] });
      expect((await approvePo(po.id)).status).toBe(422);
      expect((await w.buyer.post(`/v1/purchase-orders/${po.id}/send`).send({})).status).toBe(422);
      expect((await w.buyer.patch(`/v1/purchase-orders/${po.id}`).send({ terms: 'x' })).status).toBe(422);
      expect((await w.buyer.post(`/v1/purchase-orders/${po.id}/cancel`).send({ reason: 'cleanup' })).status).toBe(422);
      const again = await placePo(poBody(pr, [{ requisitionLineId: prLine(pr, 0), qty: '100', unitPrice: '240' }]));
      expect(again.status).toBe(201);
    });

    it('auto-approves when no PURCHASE_ORDER workflow applies', async () => {
      await ctx.prisma.approvalWorkflow.update({ where: { companyId_documentType: { companyId: w.company.id, documentType: 'PURCHASE_ORDER' } }, data: { active: false } });
      try {
        const { po } = await draftPo();
        const res = await submitPo(po.id);
        expect(res.body).toMatchObject({ status: 'APPROVED', approvedAt: expect.any(String), approvals: [] });
        const trail = await w.buyer.get(`/v1/purchase-orders/${po.id}/activity`);
        expect(trail.body.map((t: { action: string }) => t.action)).toEqual(['CREATE', 'AUTO_APPROVE']);
      } finally {
        await ctx.prisma.approvalWorkflow.update({ where: { companyId_documentType: { companyId: w.company.id, documentType: 'PURCHASE_ORDER' } }, data: { active: true } });
      }
    });
  });

  describe('send, cancel and close', () => {
    it('sends only approved orders', async () => {
      const { po } = await draftPo();
      expect((await w.buyer.post(`/v1/purchase-orders/${po.id}/send`).send({})).status).toBe(422);
      const made = await approvedPo();
      expect((await w.engineer.post(`/v1/purchase-orders/${made.po.id}/send`).send({})).status).toBe(403);
      const sent = await w.buyer.post(`/v1/purchase-orders/${made.po.id}/send`).send({});
      expect(sent.body).toMatchObject({ status: 'SENT', sentAt: expect.any(String) });
      expect((await w.buyer.post(`/v1/purchase-orders/${made.po.id}/send`).send({})).status).toBe(422);
    });

    it('cancelling a draft, pending, approved or sent order cancels its lines and frees the requisition quantity', async () => {
      const draft = await draftPo();
      expect((await w.buyer.post(`/v1/purchase-orders/${draft.po.id}/cancel`).send({})).status).toBe(400);
      const cancelled = await w.buyer.post(`/v1/purchase-orders/${draft.po.id}/cancel`).send({ reason: 'Wrong supplier' });
      expect(cancelled.body).toMatchObject({ status: 'CANCELLED', cancelReason: 'Wrong supplier', cancelledAt: expect.any(String) });
      expect(cancelled.body.lines.map((l: Json) => [l.cancelledQty, l.openQty])).toEqual([['40', '0'], ['20', '0']]);
      expect(await prState(draft.pr.id)).toEqual({ status: 'APPROVED', ordered: ['0', '0'] });
      expect((await w.buyer.post(`/v1/purchase-orders/${draft.po.id}/cancel`).send({ reason: 'Twice' })).status).toBe(422);

      const pending = await draftPo();
      await submitPo(pending.po.id);
      await w.buyer.post(`/v1/purchase-orders/${pending.po.id}/cancel`).send({ reason: 'Withdrawn' });
      expect((await ctx.prisma.approvalRequest.findFirstOrThrow({ where: { documentId: pending.po.id } })).status).toBe('CANCELLED');
      expect((await approvePo(pending.po.id)).status).toBe(422);

      const sent = await approvedPo();
      await w.buyer.post(`/v1/purchase-orders/${sent.po.id}/send`).send({});
      expect((await w.buyer.post(`/v1/purchase-orders/${sent.po.id}/cancel`).send({ reason: 'Supplier closed' })).body.status).toBe('CANCELLED');
      expect(await prState(sent.pr.id)).toEqual({ status: 'APPROVED', ordered: ['0', '0'] });
      expect((await w.viewer.post(`/v1/purchase-orders/${sent.po.id}/cancel`).send({ reason: 'nope nope' })).status).toBe(403);
    });

    it('refuses to cancel once goods were received, but closing cancels only the undelivered remainder', async () => {
      const { pr, po } = await approvedPo();
      await w.buyer.post(`/v1/purchase-orders/${po.id}/send`).send({});
      const [l1] = po.lines as Json[];
      await ctx.prisma.purchaseOrderLine.update({ where: { id: l1!.id }, data: { receivedQty: '30' } });
      await ctx.prisma.purchaseOrder.update({ where: { id: po.id }, data: { status: 'PARTIALLY_RECEIVED' } });
      expect((await w.buyer.post(`/v1/purchase-orders/${po.id}/cancel`).send({ reason: 'Too late to cancel' })).status).toBe(422);

      const closed = await w.buyer.post(`/v1/purchase-orders/${po.id}/close`).send({ reason: 'Supplier cannot deliver the balance' });
      expect(closed.status).toBe(200);
      expect(closed.body).toMatchObject({ status: 'CLOSED', closedAt: expect.any(String) });
      expect(closed.body.lines.map((l: Json) => [l.receivedQty, l.cancelledQty, l.openQty])).toEqual([['30', '10', '0'], ['0', '20', '0']]);
      expect(await prState(pr.id)).toEqual({ status: 'PARTIALLY_ORDERED', ordered: ['30', '0'] });
      expect((await w.buyer.post(`/v1/purchase-orders/${po.id}/close`).send({ reason: 'Again please' })).status).toBe(422);
      const rest = await placePo(poBody(pr, [{ requisitionLineId: prLine(pr, 0), qty: '70', unitPrice: '240' }]));
      expect(rest.status).toBe(201);
    });

    it('closes only sent or received orders', async () => {
      const { po } = await draftPo();
      expect((await w.buyer.post(`/v1/purchase-orders/${po.id}/close`).send({ reason: 'Still a draft' })).status).toBe(422);
      const made = await approvedPo();
      expect((await w.buyer.post(`/v1/purchase-orders/${made.po.id}/close`).send({ reason: 'Not sent yet' })).status).toBe(422);
      expect((await w.buyer.post(`/v1/purchase-orders/${made.po.id}/close`).send({})).status).toBe(400);
    });

    it('a requisition with purchase orders cannot be cancelled and cannot be closed while a PO is only a draft', async () => {
      const { pr, po } = await draftPo();
      const cancel = await w.engineer.post(`/v1/requisitions/${pr.id}/cancel`).send({ reason: 'Try to cancel' });
      expect(cancel.status).toBe(422);
      expect((await w.pm.post(`/v1/requisitions/${pr.id}/close`).send({ reason: 'Try to close' })).status).toBe(422);
      await w.buyer.post(`/v1/purchase-orders/${po.id}/cancel`).send({ reason: 'Back out' });
      expect((await w.pm.post(`/v1/requisitions/${pr.id}/close`).send({ reason: 'Close it now' })).body.status).toBe('CLOSED');
    });
  });

  describe('read model', () => {
    it('returns the business-document view with lines, receipts, approvals and activity sections', async () => {
      const { pr, po } = await draftPo();
      await submitPo(po.id);
      await approvePo(po.id);
      await ctx.prisma.goodsReceipt.create({
        data: { companyId: w.company.id, number: uniq('GRN'), orderId: po.id, supplierId: supplier.id, warehouseId: w.warehouse.id, receiptDate: new Date(), receivedById: w.users.admin },
      });
      const res = await w.buyer.get(`/v1/purchase-orders/${po.id}`);
      expect(res.status).toBe(200);
      expect(res.body.requisition).toMatchObject({ id: pr.id, number: pr.number });
      expect(res.body.rfq).toBeNull();
      expect(res.body.supplier).toMatchObject({ id: supplier.id, name: 'Holcim Philippines' });
      expect(res.body.lines[0]).toMatchObject({ item: { id: cement.id }, openQty: '40' });
      expect(res.body.receipts).toEqual([expect.objectContaining({ status: 'DRAFT', postedAt: null })]);
      expect(res.body.approvals).toHaveLength(1);
      expect(res.body.activity.map((a: { action: string }) => a.action)).toEqual(['CREATE', 'SUBMIT', 'APPROVED', 'STATUS_CHANGE']);
    });

    it('timeline lists audit rows and approval decisions in order with actor names', async () => {
      const { po } = await approvedPo();
      await w.buyer.post(`/v1/purchase-orders/${po.id}/send`).send({});
      const res = await w.buyer.get(`/v1/purchase-orders/${po.id}/activity`);
      const trail = res.body as Array<{ action: string; actor: { id: string; name: string } | null; at: string }>;
      expect(trail.map((t) => t.action)).toEqual(['CREATE', 'SUBMIT', 'APPROVED', 'STATUS_CHANGE', 'SEND']);
      expect(trail[0]!.actor).toMatchObject({ id: w.users.buyer, name: 'Test User' });
      expect(trail[2]!.actor).toMatchObject({ id: w.users.finance });
      const times = trail.map((t) => new Date(t.at).getTime());
      expect([...times].sort((a, b) => a - b)).toEqual(times);
      expect((await w.viewer.get(`/v1/purchase-orders/${po.id}/activity`)).status).toBe(403);
      expect((await foreign.admin.get(`/v1/purchase-orders/${po.id}/activity`)).status).toBe(404);
    });

    it('lists with filters, search, sorting, date range and cursor pagination; hides other projects and companies', async () => {
      const mark = uniq('LST');
      const pr = await approvedPr([{ itemId: cement.id, qty: '100' }]);
      const line = prLine(pr, 0);
      const ids: string[] = [];
      for (const [qty, price] of [['10', '100'], ['20', '100'], ['30', '100']] as const) {
        ids.push((await expectOk<Json>(await placePo(poBody(pr, [{ requisitionLineId: line, qty, unitPrice: price }], { terms: mark })))).id);
      }
      const p1 = await w.buyer.get('/v1/purchase-orders').query({ requisitionId: pr.id, sort: 'totalAmount:desc', limit: 2 });
      expect(p1.body.items.map((p: Json) => p.id)).toEqual([ids[2], ids[1]]);
      const p2 = await w.buyer.get('/v1/purchase-orders').query({ requisitionId: pr.id, sort: 'totalAmount:desc', limit: 2, cursor: p1.body.nextCursor });
      expect(p2.body.items.map((p: Json) => p.id)).toEqual([ids[0]]);
      expect((await w.buyer.get('/v1/purchase-orders').query({ search: mark })).body.items).toHaveLength(3);
      expect((await w.buyer.get('/v1/purchase-orders').query({ requisitionId: pr.id, status: 'APPROVED' })).body.items).toHaveLength(0);
      expect((await w.buyer.get('/v1/purchase-orders').query({ requisitionId: pr.id, supplierId: supplier.id, projectId: w.project.id })).body.items).toHaveLength(3);
      expect((await w.buyer.get('/v1/purchase-orders').query({ requisitionId: pr.id, from: daysFromNow(2) })).body.items).toHaveLength(0);
      expect((await w.buyer.get('/v1/purchase-orders').query({ sort: 'terms:asc' })).status).toBe(400);
      expect((await foreign.admin.get('/v1/purchase-orders').query({ requisitionId: pr.id })).body.items).toHaveLength(0);
      expect((await ctx.http().get('/v1/purchase-orders')).status).toBe(401);
      expect((await w.viewer.get('/v1/purchase-orders')).status).toBe(403);
      const wrongProject = await userAgent(w, ['Procurement'], { projectId: w.otherProject.id });
      expect((await wrongProject.agent.get('/v1/purchase-orders').query({ requisitionId: pr.id })).body.items).toHaveLength(0);
      expect((await wrongProject.agent.get(`/v1/purchase-orders/${ids[0]}`)).status).toBe(403);
      expect((await foreign.admin.get(`/v1/purchase-orders/${ids[0]}`)).status).toBe(404);
    });
  });

  describe('what the rest of the system derives from purchase orders', () => {
    it('feeds supplier performance, purchase history, item stock (committed), project dashboard and price history', async () => {
      const buyerSupplier = await createSupplier(w.admin, uniq('PERF'));
      const item = await createItem(w.admin, uniq('DER'), { baseUnit: 'pc' });
      const pr = await approvedPr([{ itemId: item.id, qty: '100' }]);
      const line = prLine(pr, 0);
      const make = async (qty: string) => expectOk<Json>(await placePo({ source: 'REQUISITION', requisitionId: pr.id, supplierId: buyerSupplier.id, lines: [{ requisitionLineId: line, qty, unitPrice: '100', taxPct: '12' }], expectedDate: '2026-12-01' }));
      const draft = await make('10');
      const open = await make('40');
      await submitPo(open.id);
      await approvePo(open.id);
      await w.buyer.post(`/v1/purchase-orders/${open.id}/send`).send({});

      const perf = await w.admin.get(`/v1/suppliers/${buyerSupplier.id}/performance`);
      expect(perf.body.orders).toMatchObject({ count: 1, totalValue: '4480.00', openCount: 1 });
      const history = await w.admin.get(`/v1/suppliers/${buyerSupplier.id}/purchase-history`);
      expect(history.body.items.map((p: Json) => p.id).sort()).toEqual([draft.id, open.id].sort());
      expect(history.body.items[0]).toHaveProperty('project.code');
      expect((await w.admin.get(`/v1/suppliers/${buyerSupplier.id}/purchase-history`).query({ status: 'SENT' })).body.items.map((p: Json) => p.id)).toEqual([open.id]);
      const scoped = await userAgent(w, ['Company Admin'], { projectId: w.otherProject.id });
      expect((await scoped.agent.get(`/v1/suppliers/${buyerSupplier.id}/purchase-history`)).body.items).toEqual([]);
      expect((await w.admin.delete(`/v1/suppliers/${buyerSupplier.id}`)).status).toBe(422);

      const stock = await w.admin.get(`/v1/items/${item.id}/stock`);
      expect(stock.body.warehouses).toEqual([expect.objectContaining({ warehouseId: w.warehouse.id, committed: '40', onHand: '0', available: '0' })]);
      expect(stock.body.totals.committed).toBe('40');
      await ctx.prisma.purchaseOrderLine.updateMany({ where: { orderId: open.id }, data: { receivedQty: '15' } });
      expect((await w.admin.get(`/v1/items/${item.id}/stock`)).body.totals.committed).toBe('25');

      const dash = await w.admin.get(`/v1/projects/${w.project.id}/dashboard`);
      expect(Number(dash.body.financial.committed)).toBeGreaterThan(0);
      const exact = await ctx.prisma.project.create({ data: { companyId: w.company.id, customerId: w.customerId, code: uniq('DASH'), name: 'Dash', status: 'ACTIVE', startDate: new Date() } });
      const prD = await expectOk<Json>(await w.admin.post('/v1/requisitions').send({ projectId: exact.id, warehouseId: w.warehouse.id, lines: [{ itemId: rebar.id, qty: '10' }] }));
      await w.admin.post(`/v1/requisitions/${prD.id}/submit`).set('Idempotency-Key', idemKey()).send({});
      await w.pm.post(`/v1/requisitions/${prD.id}/approve`).set('Idempotency-Key', idemKey()).send({});
      const poD = await expectOk<Json>(await placePo(poBody(prD, [{ requisitionLineId: prLine(prD, 0), qty: '10', unitPrice: '1000', taxPct: '12' }])));
      await submitPo(poD.id);
      await approvePo(poD.id);
      // 10 x 1000 = 10,000 + 1,200 tax. Receive 4 of 10: 60% of 11,200 = 6,720 still committed.
      expect((await w.admin.get(`/v1/projects/${exact.id}/dashboard`)).body.financial.committed).toBe('11200.00');
      await ctx.prisma.purchaseOrderLine.updateMany({ where: { orderId: poD.id }, data: { receivedQty: '4' } });
      expect((await w.admin.get(`/v1/projects/${exact.id}/dashboard`)).body.financial.committed).toBe('6720.00');
      expect((await w.admin.get(`/v1/projects/${exact.id}/dashboard`)).body.counts.openPurchaseOrders).toBe(1);

      const prices = await w.admin.get(`/v1/items/${item.id}/price-history`);
      expect(prices.body.items.map((p: Json) => [p.source, p.reference === open.number])).toEqual([['PURCHASE_ORDER', true]]);
      expect(prices.body.items[0]).toMatchObject({ unitPrice: '100', qty: '40', supplier: { id: buyerSupplier.id }, taxPct: '12' });
    });
  });
});
