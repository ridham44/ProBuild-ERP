import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startApp, stopApp, TestContext } from './support/app';
import { buildWorld, createItem, createSupplier, expectOk, idemKey, Json, setWorkflow, uniq, userAgent, World } from './support/world';

const daysFromNow = (n: number): string => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

describe('RFQ, supplier quotation, comparison and award', () => {
  let ctx: TestContext;
  let w: World;
  let foreign: World;
  let cement: Json;
  let rebar: Json;
  let supA: Json;
  let supB: Json;
  let supC: Json;

  beforeAll(async () => {
    ctx = await startApp();
    w = await buildWorld(ctx, 'RFQ');
    foreign = await buildWorld(ctx, 'RFQX');
    await setWorkflow(w.admin, 'PURCHASE_REQUISITION', [{ minAmount: '0', steps: ['Project Manager'] }]);
    [supA, supB, supC] = await Promise.all([createSupplier(w.admin, uniq('A')), createSupplier(w.admin, uniq('B')), createSupplier(w.admin, uniq('C'))]);
    cement = await createItem(w.admin, uniq('CEM'), { baseUnit: 'bag', preferredSupplierId: supC.id });
    rebar = await createItem(w.admin, uniq('RB'), { baseUnit: 'pc' });
  });
  afterAll(() => stopApp(ctx));

  const approvedPr = async (lines: Array<Record<string, unknown>> = [{ itemId: cement.id, qty: '100' }, { itemId: rebar.id, qty: '50' }]): Promise<Json> => {
    const pr = await expectOk<Json>(await w.engineer.post('/v1/requisitions').send({ projectId: w.project.id, warehouseId: w.warehouse.id, lines }));
    await expectOk(await w.engineer.post(`/v1/requisitions/${pr.id}/submit`).set('Idempotency-Key', idemKey()).send({}));
    await expectOk(await w.pm.post(`/v1/requisitions/${pr.id}/approve`).set('Idempotency-Key', idemKey()).send({}));
    return pr;
  };
  const rfqBody = (pr: Json, suppliers: Json[], extra: Record<string, unknown> = {}) => ({
    requisitionId: pr.id,
    supplierIds: suppliers.map((s) => s.id),
    lines: (pr.lines as Json[]).map((l) => ({ requisitionLineId: l.id })),
    dueDate: daysFromNow(7),
    deliveryRequirements: 'Deliver to site gate 2, 7am-4pm',
    ...extra,
  });
  const createRfq = async (pr?: Json, suppliers: Json[] = [supA, supB, supC]): Promise<Json> => {
    const source = pr ?? (await approvedPr());
    return expectOk<Json>(await w.buyer.post('/v1/rfqs').send(rfqBody(source, suppliers)));
  };
  const sentRfq = async (suppliers: Json[] = [supA, supB, supC]): Promise<Json> => {
    const rfq = await createRfq(undefined, suppliers);
    await expectOk(await w.buyer.post(`/v1/rfqs/${rfq.id}/send`).send({}));
    return (await w.buyer.get(`/v1/rfqs/${rfq.id}`)).body as Json;
  };
  const quote = (rfq: Json, supplier: Json, lines: Array<Record<string, unknown>>, extra: Record<string, unknown> = {}, agent = w.buyer) =>
    agent.post(`/v1/rfqs/${rfq.id}/quotations`).send({ supplierId: supplier.id, quoteDate: '2026-10-01', lines, ...extra });
  const lineIds = (rfq: Json): string[] => (rfq.lines as Json[]).map((l) => l.id);

  describe('create RFQ from an approved requisition', () => {
    it('creates a draft with the selected lines, suppliers and delivery requirements', async () => {
      const pr = await approvedPr([{ itemId: cement.id, qty: '100' }, { itemId: rebar.id, qty: '50' }, { itemId: cement.id, qty: '5' }]);
      const prLines = pr.lines as Json[];
      const res = await w.buyer.post('/v1/rfqs').send({
        requisitionId: pr.id, supplierIds: [supA.id, supB.id], dueDate: daysFromNow(5), requiredDate: daysFromNow(20),
        deliveryRequirements: 'Staggered delivery', deliveryLocation: 'Lot 5, Mactan', remarks: 'Urgent',
        lines: [{ requisitionLineId: prLines[0]!.id }, { requisitionLineId: prLines[1]!.id, qty: '30' }],
      });
      expect(res.status).toBe(201);
      expect(res.body.number).toMatch(/^RFQ-\d{4}-\d{5}$/);
      expect(res.body).toMatchObject({
        status: 'DRAFT', projectId: w.project.id, requisition: { id: pr.id }, deliveryRequirements: 'Staggered delivery', deliveryLocation: 'Lot 5, Mactan',
      });
      expect((res.body.lines as Json[]).map((l) => [l.lineNo, l.qty, l.unit])).toEqual([[1, '100', 'bag'], [2, '30', 'pc']]);
      expect((res.body.suppliers as Json[]).map((s) => s.status)).toEqual(['INVITED', 'INVITED']);
    });

    it('requires an approved requisition with remaining quantity', async () => {
      const draft = await expectOk<Json>(await w.engineer.post('/v1/requisitions').send({ projectId: w.project.id, lines: [{ itemId: cement.id, qty: '1' }] }));
      const submittedPr = await expectOk<Json>(await w.engineer.post('/v1/requisitions').send({ projectId: w.project.id, lines: [{ itemId: cement.id, qty: '1' }] }));
      await w.engineer.post(`/v1/requisitions/${submittedPr.id}/submit`).set('Idempotency-Key', idemKey()).send({});
      for (const pr of [draft, submittedPr]) {
        const res = await w.buyer.post('/v1/rfqs').send(rfqBody(pr, [supA]));
        expect(res.status).toBe(422);
        expect(res.body.detail).toContain('approved requisition');
      }
      const closed = await approvedPr();
      await w.pm.post(`/v1/requisitions/${closed.id}/close`).send({ reason: 'No longer required' });
      expect((await w.buyer.post('/v1/rfqs').send(rfqBody(closed, [supA]))).status).toBe(422);
    });

    it('validates input (400) and lines, quantities, suppliers and due date (422)', async () => {
      const pr = await approvedPr();
      const ok = rfqBody(pr, [supA]);
      for (const bad of [{ ...ok, supplierIds: [] }, { ...ok, supplierIds: [supA.id, supA.id] }, { ...ok, lines: [] }, { ...ok, dueDate: undefined }, { ...ok, requisitionId: 'x' }]) {
        expect((await w.buyer.post('/v1/rfqs').send(bad)).status).toBe(400);
      }
      const otherPr = await approvedPr();
      const lineFromOther = (otherPr.lines as Json[])[0]!.id;
      const issues = async (override: Record<string, unknown>): Promise<string[]> => {
        const res = await w.buyer.post('/v1/rfqs').send({ ...ok, ...override });
        expect(res.status).toBe(422);
        return (res.body.errors as Array<{ path: string }>).map((e) => e.path);
      };
      expect(await issues({ lines: [{ requisitionLineId: lineFromOther }] })).toContain('lines.0.requisitionLineId');
      expect(await issues({ lines: [{ requisitionLineId: (pr.lines as Json[])[0]!.id, qty: '100.0001' }] })).toContain('lines.0.qty');
      expect(await issues({ dueDate: '2020-01-01' })).toContain('dueDate');
      const theirSupplier = await createSupplier(foreign.admin);
      expect(await issues({ supplierIds: [theirSupplier.id] })).toContain('supplierIds.0');
      const inactive = await createSupplier(w.admin);
      await w.admin.patch(`/v1/suppliers/${inactive.id}`).send({ active: false });
      expect(await issues({ supplierIds: [inactive.id] })).toContain('supplierIds.0');
    });

    it('requires authentication and permission, and hides other companies and projects', async () => {
      const pr = await approvedPr();
      const body = rfqBody(pr, [supA]);
      expect((await ctx.http().post('/v1/rfqs').send(body)).status).toBe(401);
      expect((await w.engineer.post('/v1/rfqs').send(body)).status).toBe(403);
      expect((await w.viewer.get('/v1/rfqs')).status).toBe(403);
      expect((await foreign.admin.post('/v1/rfqs').send(body)).status).toBe(422);
      const rfq = await createRfq(pr);
      expect((await foreign.admin.get(`/v1/rfqs/${rfq.id}`)).status).toBe(404);
      expect((await foreign.admin.get(`/v1/rfqs/${rfq.id}/comparison`)).status).toBe(404);
      expect((await foreign.admin.post(`/v1/rfqs/${rfq.id}/send`).send({})).status).toBe(404);
      const wrongProject = await userAgent(w, ['Procurement'], { projectId: w.otherProject.id });
      expect((await wrongProject.agent.get(`/v1/rfqs/${rfq.id}`)).status).toBe(403);
      expect((await wrongProject.agent.post('/v1/rfqs').send(body)).status).toBe(403);
      expect((await wrongProject.agent.post(`/v1/rfqs/${rfq.id}/send`).send({})).status).toBe(403);
      expect((await wrongProject.agent.get('/v1/rfqs').query({ limit: 100 })).body.items.map((r: Json) => r.id)).not.toContain(rfq.id);
    });

    it('lists with filters, search and cursor pagination', async () => {
      const pr = await approvedPr();
      const a = await createRfq(pr, [supA]);
      const b = await createRfq(pr, [supB]);
      const res = await w.buyer.get('/v1/rfqs').query({ requisitionId: pr.id, sort: 'number:asc', limit: 1 });
      expect(res.body.items.map((r: Json) => r.id)).toEqual([a.id]);
      const next = await w.buyer.get('/v1/rfqs').query({ requisitionId: pr.id, sort: 'number:asc', limit: 1, cursor: res.body.nextCursor });
      expect(next.body.items.map((r: Json) => r.id)).toEqual([b.id]);
      expect((await w.buyer.get('/v1/rfqs').query({ supplierId: supB.id, requisitionId: pr.id })).body.items.map((r: Json) => r.id)).toEqual([b.id]);
      expect((await w.buyer.get('/v1/rfqs').query({ search: a.number })).body.items).toHaveLength(1);
      expect((await w.buyer.get('/v1/rfqs').query({ status: 'SENT', requisitionId: pr.id })).body.items).toHaveLength(0);
    });
  });

  describe('edit, send, cancel and close', () => {
    it('edits a draft, sends it, and then refuses further edits', async () => {
      const rfq = await createRfq(undefined, [supA]);
      const edited = await w.buyer.patch(`/v1/rfqs/${rfq.id}`).send({ supplierIds: [supB.id, supC.id], remarks: 'Updated scope', dueDate: daysFromNow(10) });
      expect(edited.status).toBe(200);
      expect((edited.body.suppliers as Json[]).map((s) => s.supplierId).sort()).toEqual([supB.id, supC.id].sort());
      expect(edited.body.remarks).toBe('Updated scope');
      const sent = await w.buyer.post(`/v1/rfqs/${rfq.id}/send`).send({});
      expect(sent.body).toMatchObject({ status: 'SENT', sentAt: expect.any(String) });
      expect((sent.body.suppliers as Json[]).every((s) => s.status === 'SENT' && s.sentAt)).toBe(true);
      expect((await w.buyer.patch(`/v1/rfqs/${rfq.id}`).send({ remarks: 'late' })).status).toBe(422);
      expect((await w.buyer.post(`/v1/rfqs/${rfq.id}/send`).send({})).status).toBe(422);
      expect((await w.engineer.post(`/v1/rfqs/${rfq.id}/send`).send({})).status).toBe(403);
    });

    it('cancels before an award and records why; closes without an award', async () => {
      const rfq = await createRfq();
      expect((await w.buyer.post(`/v1/rfqs/${rfq.id}/cancel`).send({})).status).toBe(400);
      expect((await w.buyer.post(`/v1/rfqs/${rfq.id}/cancel`).send({ reason: 'Scope changed' })).body.status).toBe('CANCELLED');
      expect((await w.buyer.post(`/v1/rfqs/${rfq.id}/send`).send({})).status).toBe(422);
      expect((await w.buyer.post(`/v1/rfqs/${rfq.id}/cancel`).send({ reason: 'Again' })).status).toBe(422);

      const sent = await sentRfq();
      expect((await w.buyer.post(`/v1/rfqs/${sent.id}/close`).send({ reason: 'No acceptable bids' })).body).toMatchObject({ status: 'CLOSED', closedAt: expect.any(String) });
      expect((await quote(sent, supA, [{ rfqLineId: lineIds(sent)[0], unitPrice: '1' }])).status).toBe(422);
      const draft = await createRfq();
      expect((await w.buyer.post(`/v1/rfqs/${draft.id}/close`).send({ reason: 'Not sent' })).status).toBe(422);
    });

    it('blocks cancelling or closing a requisition while it has a live RFQ', async () => {
      const pr = await approvedPr();
      const rfq = await createRfq(pr);
      expect((await w.engineer.post(`/v1/requisitions/${pr.id}/cancel`).send({ reason: 'Try it' })).status).toBe(422);
      expect((await w.pm.post(`/v1/requisitions/${pr.id}/close`).send({ reason: 'Try it' })).status).toBe(422);
      await w.buyer.post(`/v1/rfqs/${rfq.id}/cancel`).send({ reason: 'Redo' });
      expect((await w.pm.post(`/v1/requisitions/${pr.id}/close`).send({ reason: 'Now fine' })).body.status).toBe('CLOSED');
    });
  });

  describe('supplier quotations', () => {
    it('records a quotation with per-line discount, tax, delivery and totals computed with decimal math', async () => {
      const rfq = await sentRfq();
      const [l1, l2] = lineIds(rfq);
      const res = await quote(
        rfq, supB,
        [
          { rfqLineId: l1, unitPrice: '255', discountPct: '2', taxPct: '12', deliveryDate: '2026-10-15', brand: 'Eagle', specification: 'Type 1' },
          { rfqLineId: l2, unitPrice: '128.5', taxPct: '12' },
        ],
        { quoteNo: 'Q-8841', validUntil: '2099-01-01', deliveryDays: 14, paymentTerms: '30 days PDC', warranty: '1 year', freight: '1500.50' },
      );
      expect(res.status).toBe(201);
      // L1: gross 25500, discount 510, net 24990, tax 2998.80. L2: gross 6425, tax 771.
      expect(res.body).toMatchObject({
        status: 'SUBMITTED', quoteNo: 'Q-8841', paymentTerms: '30 days PDC', deliveryDays: 14, currency: 'PHP',
        subtotal: '31925', discountAmount: '510', taxAmount: '3769.8', freight: '1500.5', totalAmount: '36685.3',
      });
      const [a, b] = res.body.lines as Json[];
      expect(a).toMatchObject({ qty: '100', unitPrice: '255', discountPct: '2', discountAmount: '510', taxAmount: '2998.8', lineTotal: '24990', brand: 'Eagle' });
      expect(b).toMatchObject({ lineTotal: '6425', taxAmount: '771' });
      const after = await w.buyer.get(`/v1/rfqs/${rfq.id}`);
      expect(after.body.status).toBe('QUOTED');
      expect((after.body.suppliers as Json[]).find((s) => s.supplierId === supB.id)).toMatchObject({ status: 'QUOTED', respondedAt: expect.any(String) });
    });

    it('rejects quotations for the wrong RFQ state, supplier or lines', async () => {
      const draft = await createRfq();
      const [d1] = lineIds(draft);
      expect((await quote(draft, supA, [{ rfqLineId: d1, unitPrice: '10' }])).status).toBe(422);

      const rfq = await sentRfq([supA, supB]);
      const [l1] = lineIds(rfq);
      expect((await quote(rfq, supC, [{ rfqLineId: l1, unitPrice: '10' }])).status).toBe(422);
      expect((await quote(rfq, supA, [{ rfqLineId: lineIds(draft)[0], unitPrice: '10' }])).status).toBe(422);
      const tooMany = await quote(rfq, supA, [{ rfqLineId: l1, unitPrice: '10', qty: '1000' }]);
      expect(tooMany.status).toBe(422);
      expect(JSON.stringify(tooMany.body.errors)).toContain('lines.0.qty');
      for (const bad of [[], [{ rfqLineId: l1, unitPrice: '-1' }], [{ rfqLineId: l1, unitPrice: '1.00001' }], [{ rfqLineId: l1, unitPrice: '1', discountPct: '101' }], [{ rfqLineId: l1, unitPrice: '1' }, { rfqLineId: l1, unitPrice: '2' }]]) {
        expect((await quote(rfq, supA, bad)).status).toBe(400);
      }
      expect((await quote(rfq, supA, [{ rfqLineId: l1, unitPrice: '10' }], { quoteDate: '2026-10-05', validUntil: '2026-10-01' })).status).toBe(400);
    });

    it('allows one quotation per supplier; revising replaces its lines and totals', async () => {
      const rfq = await sentRfq([supA]);
      const [l1, l2] = lineIds(rfq);
      const first = await quote(rfq, supA, [{ rfqLineId: l1, unitPrice: '250' }, { rfqLineId: l2, unitPrice: '130' }]);
      expect(first.body.totalAmount).toBe('31500');
      expect((await quote(rfq, supA, [{ rfqLineId: l1, unitPrice: '1' }])).status).toBe(409);
      const revised = await w.buyer.put(`/v1/quotations/${first.body.id}`).send({
        quoteDate: '2026-10-02', lines: [{ rfqLineId: l1, unitPrice: '240', taxPct: '12' }], freight: '100',
      });
      expect(revised.status).toBe(200);
      expect(revised.body.lines).toHaveLength(1);
      expect(revised.body).toMatchObject({ subtotal: '24000', taxAmount: '2880', totalAmount: '26980' });
      expect((await w.engineer.put(`/v1/quotations/${first.body.id}`).send({ quoteDate: '2026-10-02', lines: [{ rfqLineId: l1, unitPrice: '1' }] })).status).toBe(403);
      expect((await foreign.admin.put(`/v1/quotations/${first.body.id}`).send({ quoteDate: '2026-10-02', lines: [{ rfqLineId: l1, unitPrice: '1' }] })).status).toBe(404);
      expect((await ctx.http().get(`/v1/quotations/${first.body.id}`)).status).toBe(401);
    });

    it('lists and reads quotations with filters and project scope', async () => {
      const rfq = await sentRfq([supA, supB]);
      const [l1] = lineIds(rfq);
      await quote(rfq, supA, [{ rfqLineId: l1, unitPrice: '10' }]);
      await quote(rfq, supB, [{ rfqLineId: l1, unitPrice: '11' }]);
      const list = await w.buyer.get('/v1/quotations').query({ rfqId: rfq.id });
      expect(list.body.items).toHaveLength(2);
      expect((await w.buyer.get('/v1/quotations').query({ rfqId: rfq.id, supplierId: supB.id })).body.items).toHaveLength(1);
      const detail = await w.buyer.get(`/v1/quotations/${list.body.items[0].id}`);
      expect(detail.body.lines[0]).toMatchObject({ item: { id: expect.any(String) }, rfqLine: { id: l1 } });
      const wrongProject = await userAgent(w, ['Procurement'], { projectId: w.otherProject.id });
      expect((await wrongProject.agent.get(`/v1/quotations/${list.body.items[0].id}`)).status).toBe(403);
      expect((await wrongProject.agent.get('/v1/quotations').query({ rfqId: rfq.id })).body.items).toHaveLength(0);
    });
  });

  describe('comparison matrix', () => {
    it('flags lowest price, fastest delivery and preferred supplier and computes variance with decimals', async () => {
      const rfq = await sentRfq();
      const [l1, l2] = lineIds(rfq);
      const common = { quoteDate: '2026-10-01', validUntil: '2099-01-01' };
      await quote(rfq, supA, [{ rfqLineId: l1, unitPrice: '250', taxPct: '12' }, { rfqLineId: l2, unitPrice: '130', taxPct: '12' }], { ...common, deliveryDays: 7 });
      await quote(rfq, supB, [{ rfqLineId: l1, unitPrice: '255', discountPct: '2', taxPct: '12' }, { rfqLineId: l2, unitPrice: '128', taxPct: '12' }], { ...common, deliveryDays: 14 });
      await quote(rfq, supC, [{ rfqLineId: l1, unitPrice: '260', taxPct: '12' }, { rfqLineId: l2, unitPrice: '125', taxPct: '12', deliveryDate: '2026-10-05' }], { ...common, deliveryDays: 21 });

      const res = await w.buyer.get(`/v1/rfqs/${rfq.id}/comparison`);
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ rfqId: rfq.id, status: 'QUOTED', awardedQuotationId: null });
      expect(res.body.suppliers).toHaveLength(3);
      const matrix = res.body.lines as Array<{ lowestNetUnitPrice: string; fastestDeliveryDate: string; offers: Json[]; qty: string }>;
      expect(matrix).toHaveLength(2);

      const offer = (line: number, supplier: Json) => matrix[line]!.offers.find((o) => o.supplierId === supplier.id)!;
      // Line 1: net prices A 250, B 249.90 (255 less 2%), C 260. Lowest is B; A is 0.04% above, C 4.04%.
      expect(matrix[0]!.lowestNetUnitPrice).toBe('249.9');
      expect(offer(0, supB)).toMatchObject({ netUnitPrice: '249.9', isLowestPrice: true, varianceFromLowestPct: '0', varianceFromLowestAmount: '0' });
      expect(offer(0, supA)).toMatchObject({ isLowestPrice: false, varianceFromLowestPct: '0.04', varianceFromLowestAmount: '0.1' });
      expect(offer(0, supC)).toMatchObject({ isLowestPrice: false, varianceFromLowestPct: '4.04', isPreferredSupplier: true });
      expect(offer(0, supA).isPreferredSupplier).toBe(false);
      // Delivery: A quote date + 7 days is the earliest on line 1.
      expect(offer(0, supA)).toMatchObject({ isFastestDelivery: true });
      expect(offer(0, supB).isFastestDelivery).toBe(false);
      // Line 2: C is cheapest (125) and, with an explicit delivery date, also the fastest.
      expect(offer(1, supC)).toMatchObject({ isLowestPrice: true, isFastestDelivery: true, varianceFromLowestPct: '0' });
      expect(offer(1, supA)).toMatchObject({ varianceFromLowestPct: '4', isFastestDelivery: false });
      expect(offer(1, supB)).toMatchObject({ varianceFromLowestPct: '2.4' });
      expect(matrix[1]!.fastestDeliveryDate).toContain('2026-10-05');

      const totals = Object.fromEntries((res.body.suppliers as Json[]).map((s) => [s.supplierId, s]));
      expect(totals[supA.id]).toMatchObject({ totalAmount: '35280', coversAllLines: true, isLowestTotal: false, varianceFromLowestTotalPct: '0.35' });
      expect(totals[supB.id]).toMatchObject({ totalAmount: '35156.8', discountAmount: '510', isLowestTotal: true, varianceFromLowestTotalPct: '0' });
      expect(totals[supC.id]).toMatchObject({ totalAmount: '36120', isLowestTotal: false, varianceFromLowestTotalPct: '2.74' });
    });

    it('marks short and partial quotes and keeps incomplete suppliers out of the lowest-total flag', async () => {
      const rfq = await sentRfq([supA, supB]);
      const [l1, l2] = lineIds(rfq);
      await quote(rfq, supA, [{ rfqLineId: l1, unitPrice: '200', qty: '40' }]);
      await quote(rfq, supB, [{ rfqLineId: l1, unitPrice: '210' }, { rfqLineId: l2, unitPrice: '100' }]);
      const res = await w.buyer.get(`/v1/rfqs/${rfq.id}/comparison`);
      const a = (res.body.suppliers as Json[]).find((s) => s.supplierId === supA.id)!;
      const b = (res.body.suppliers as Json[]).find((s) => s.supplierId === supB.id)!;
      expect(a).toMatchObject({ coversAllLines: false, isLowestTotal: false, quotedLines: 1 });
      expect(b).toMatchObject({ coversAllLines: true, isLowestTotal: true });
      const line1 = (res.body.lines as Array<{ offers: Json[] }>)[0]!.offers.find((o) => o.supplierId === supA.id)!;
      expect(line1).toMatchObject({ isShortQuote: true, isLowestPrice: true });
      const line2 = (res.body.lines as Array<{ offers: Json[] }>)[1]!;
      expect(line2.offers).toHaveLength(1);
    });

    it('returns an empty matrix before any quotation and respects permission and scope', async () => {
      const rfq = await sentRfq();
      const res = await w.buyer.get(`/v1/rfqs/${rfq.id}/comparison`);
      expect(res.body.suppliers).toEqual([]);
      expect((res.body.lines as Array<{ offers: Json[]; lowestNetUnitPrice: unknown }>).every((l) => l.offers.length === 0 && l.lowestNetUnitPrice === null)).toBe(true);
      expect((await w.viewer.get(`/v1/rfqs/${rfq.id}/comparison`)).status).toBe(403);
      expect((await ctx.http().get(`/v1/rfqs/${rfq.id}/comparison`)).status).toBe(401);
    });
  });

  describe('award', () => {
    const award = (rfq: Json, quotationId: string, agent = w.buyer, key = idemKey('awd')) =>
      agent.post(`/v1/rfqs/${rfq.id}/award`).set('Idempotency-Key', key).send({ quotationId, reason: 'Best total price' });
    const quotedRfq = async () => {
      const rfq = await sentRfq([supA, supB]);
      const [l1, l2] = lineIds(rfq);
      const a = await quote(rfq, supA, [{ rfqLineId: l1, unitPrice: '250' }, { rfqLineId: l2, unitPrice: '130' }], { validUntil: '2099-01-01' });
      const b = await quote(rfq, supB, [{ rfqLineId: l1, unitPrice: '240' }, { rfqLineId: l2, unitPrice: '125' }], { validUntil: '2099-01-01' });
      return { rfq, a: a.body as Json, b: b.body as Json };
    };

    it('awards one quotation: writes the award record, marks the others, and closes bidding', async () => {
      const { rfq, a, b } = await quotedRfq();
      const res = await award(rfq, b.id);
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ status: 'AWARDED', awardedQuotationId: b.id, awardedAt: expect.any(String), closedAt: expect.any(String) });
      expect(res.body.award).toMatchObject({ quotationId: b.id, supplierId: supB.id, reason: 'Best total price', totalAmount: '30250' });
      const quotations = await ctx.prisma.supplierQuotation.findMany({ where: { rfqId: rfq.id } });
      expect(Object.fromEntries(quotations.map((q) => [q.id, q.status]))).toEqual({ [a.id as string]: 'NOT_AWARDED', [b.id as string]: 'AWARDED' });
      expect(await ctx.prisma.rfqAward.count({ where: { rfqId: rfq.id } })).toBe(1);
      const comparison = await w.buyer.get(`/v1/rfqs/${rfq.id}/comparison`);
      expect(comparison.body.awardedQuotationId).toBe(b.id);
    });

    it('is idempotent and refuses a second award, edits and new quotations afterwards', async () => {
      const { rfq, a, b } = await quotedRfq();
      const key = idemKey('awd');
      const first = await award(rfq, b.id, w.buyer, key);
      const replay = await award(rfq, b.id, w.buyer, key);
      expect(replay.headers['idempotent-replayed']).toBe('true');
      expect(replay.body).toEqual(first.body);
      expect((await award(rfq, a.id)).status).toBe(422);
      expect((await award(rfq, b.id)).status).toBe(422);
      expect((await w.buyer.put(`/v1/quotations/${a.id}`).send({ quoteDate: '2026-10-03', lines: [{ rfqLineId: lineIds(rfq)[0], unitPrice: '1' }] })).status).toBe(422);
      expect((await quote(rfq, supC, [{ rfqLineId: lineIds(rfq)[0], unitPrice: '1' }])).status).toBe(422);
      expect((await w.buyer.post(`/v1/rfqs/${rfq.id}/cancel`).send({ reason: 'Too late' })).status).toBe(422);
      expect((await w.buyer.post(`/v1/rfqs/${rfq.id}/close`).send({ reason: 'Fully ordered' })).body.status).toBe('CLOSED');
      const trail = await w.buyer.get(`/v1/rfqs/${rfq.id}/activity`);
      expect(trail.body.map((t: { action: string }) => t.action)).toEqual(['CREATE', 'SEND', 'QUOTATION_RECEIVED', 'QUOTATION_RECEIVED', 'AWARD', 'CLOSE']);
    });

    it('validates the quotation, its validity and who may award', async () => {
      const { rfq, b } = await quotedRfq();
      const other = await quotedRfq();
      expect((await award(rfq, other.b.id as string)).status).toBe(422);
      expect((await award(rfq, 'not-a-uuid')).status).toBe(400);
      expect((await w.buyer.post(`/v1/rfqs/${rfq.id}/award`).send({ quotationId: b.id })).status).toBe(400);
      expect((await award(rfq, b.id, w.engineer)).status).toBe(403);
      expect((await award(rfq, b.id, w.viewer)).status).toBe(403);
      expect((await award(rfq, b.id, foreign.admin)).status).toBe(404);
      const wrongProject = await userAgent(w, ['Procurement'], { projectId: w.otherProject.id });
      expect((await award(rfq, b.id, wrongProject.agent)).status).toBe(403);
      expect((await ctx.http().post(`/v1/rfqs/${rfq.id}/award`).set('Idempotency-Key', idemKey()).send({ quotationId: b.id })).status).toBe(401);

      const stale = await sentRfq([supA]);
      const staleQuote = await quote(stale, supA, [{ rfqLineId: lineIds(stale)[0], unitPrice: '5' }], { quoteDate: '2025-01-01', validUntil: '2025-02-01' });
      const res = await award(stale, staleQuote.body.id as string);
      expect(res.status).toBe(422);
      expect(res.body.detail).toContain('expired');
      expect((await w.buyer.get(`/v1/rfqs/${rfq.id}`)).body.status).toBe('QUOTED');
    });

    it('only one of two simultaneous awards of different quotations wins', async () => {
      const { rfq, a, b } = await quotedRfq();
      const [ra, rb] = await Promise.all([award(rfq, a.id), award(rfq, b.id)]);
      expect([ra.status, rb.status].sort()).toEqual([200, 422]);
      expect(await ctx.prisma.rfqAward.count({ where: { rfqId: rfq.id } })).toBe(1);
      expect(await ctx.prisma.supplierQuotation.count({ where: { rfqId: rfq.id, status: 'AWARDED' } })).toBe(1);
    });
  });

  describe('price history', () => {
    it('keeps every quoted price queryable per item and supplier, newest first, with cursor paging', async () => {
      const item = await createItem(w.admin, uniq('HIST'), { baseUnit: 'pc' });
      const pr = await approvedPr([{ itemId: item.id, qty: '10' }]);
      for (const [supplier, date, price] of [[supA, '2026-08-01', '100'], [supB, '2026-09-01', '95'], [supA, '2026-10-01', '105']] as const) {
        const rfq = await createRfq(pr, [supA, supB]);
        await w.buyer.post(`/v1/rfqs/${rfq.id}/send`).send({});
        await expectOk(await quote(rfq, supplier, [{ rfqLineId: lineIds((await w.buyer.get(`/v1/rfqs/${rfq.id}`)).body as Json)[0], unitPrice: price, discountPct: '5' }], { quoteDate: date }));
      }
      const all = await w.buyer.get(`/v1/items/${item.id}/price-history`);
      expect(all.status).toBe(200);
      expect(all.body.items.map((r: Json) => r.unitPrice)).toEqual(['105', '95', '100']);
      expect(all.body.items[0]).toMatchObject({ source: 'QUOTATION', supplier: { id: supA.id }, netUnitPrice: '99.75', unit: 'pc', discountPct: '5' });
      const p1 = await w.buyer.get(`/v1/items/${item.id}/price-history`).query({ limit: 2 });
      const p2 = await w.buyer.get(`/v1/items/${item.id}/price-history`).query({ limit: 2, cursor: p1.body.nextCursor });
      expect([...p1.body.items, ...p2.body.items].map((r: Json) => r.unitPrice)).toEqual(['105', '95', '100']);
      expect(p2.body.nextCursor).toBeNull();
      const bySupplier = await w.buyer.get(`/v1/items/${item.id}/price-history`).query({ supplierId: supA.id });
      expect(bySupplier.body.items.map((r: Json) => r.unitPrice)).toEqual(['105', '100']);
      const ranged = await w.buyer.get(`/v1/items/${item.id}/price-history`).query({ from: '2026-09-01', to: '2026-09-30' });
      expect(ranged.body.items.map((r: Json) => r.unitPrice)).toEqual(['95']);
      expect((await w.buyer.get(`/v1/items/${item.id}/price-history`).query({ source: 'PURCHASE_ORDER' })).body.items).toEqual([]);
      expect((await w.buyer.get(`/v1/items/${item.id}/price-history`).query({ cursor: 'garbage' })).status).toBe(422);
      expect((await w.viewer.get(`/v1/items/${item.id}/price-history`)).status).toBe(403);
    });
  });
});
