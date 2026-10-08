import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startApp, stopApp, TestContext } from './support/app';
import { StockActors, stockActors } from './support/stock';
import { Agent, buildWorld, expectOk, idemKey, Json, setWorkflow, uniq, userAgent, World } from './support/world';

type State = {
  lines: Json[];
  branch: Json; customer: Json; holcim: Json; republic: Json; mactan: Json; cementCat: Json; cement: Json; rebar: Json;
  warehouse: Json; bin: Json; costCode: Json; project: Json; wbsRoot: Json; wbs: Json; estimate: Json; boqConcrete: Json; boqRebar: Json;
  pr: Json; rfq: Json; steelRfq: Json; qHolcim: Json; qRepublic: Json; qMactan: Json; qSteel: Json; po: Json; poSteel: Json;
  grn1: Json; mr: Json; issue: Json;
};

/**
 * Full acceptance flow for a Philippine contractor, one scenario in order:
 *   company, branch, customer, suppliers, warehouse + bin, items, cost code, project, WBS, approved BOQ/budget
 *   -> purchase requisition (submit, approve) -> RFQ to three suppliers, quotations, comparison, award
 *   -> purchase order (approve, send) -> goods receipt (partial) -> QC -> stock -> receipt of the remainder -> stock
 *   -> material request (approve, reduced) -> material issue -> inventory, project cost ledger, budget vs actual, audit trail
 *   -> cross-company access, unauthorized actions, over-receipt, over-issue, duplicates, concurrency, invalid transitions
 *   -> reconciliation: every StockBalance equals the sum of its ledger rows.
 * The scenario state lives in `s`; each `it` depends on the ones before it.
 */
describe('Acceptance: procure-to-pay-in-stock to project cost', () => {
  let ctx: TestContext;
  let w: World;
  let rival: World;
  let a: StockActors;
  let site: Agent;

  // Filled in, in order, by the steps below; later steps depend on earlier ones.
  const s = {} as State;

  beforeAll(async () => {
    ctx = await startApp();
    w = await buildWorld(ctx, 'Pinoy');
    rival = await buildWorld(ctx, 'Rival');
    await setWorkflow(w.admin, 'PURCHASE_REQUISITION', [
      { minAmount: '0', maxAmount: '250000', steps: ['Project Manager'] },
      { minAmount: '250000.01', steps: ['Project Manager', 'Finance'] },
    ]);
    await setWorkflow(w.admin, 'PURCHASE_ORDER', [
      { minAmount: '0', maxAmount: '500000', steps: ['Finance'] },
      { minAmount: '500000.01', steps: ['Finance', 'Company Admin'] },
    ]);
  });
  afterAll(() => stopApp(ctx));

  it('sets up branch, customer, suppliers, items, warehouse and a cost code', async () => {
    s.branch = await expectOk<Json>(await w.admin.post('/v1/branches').send({ code: uniq('CEB'), name: 'Cebu branch', address: 'Mandaue City' }));
    s.customer = await expectOk<Json>(
      await w.admin.post('/v1/customers').send({ code: uniq('MEG'), name: 'Megaworld Land Inc.', tin: '000-111-222-000', paymentTermsDays: 30 }),
    );
    await expectOk(await w.admin.post(`/v1/customers/${s.customer.id}/contacts`).send({ name: 'Ana Cruz', position: 'Project Owner Representative', isPrimary: true }));

    const supplierSpecs = [
      ['holcim', 'Holcim Philippines Inc.', 'Cement'],
      ['republic', 'Republic Cement & Building Materials', 'Cement'],
      ['mactan', 'Mactan Steel Trading', 'Steel'],
    ] as const;
    for (const [key, name, category] of supplierSpecs) {
      s[key] = await expectOk<Json>(await w.admin.post('/v1/suppliers').send({ code: uniq(key.toUpperCase()), name, category, tin: '123-456-789-000', paymentTermsDays: 30 }));
      await expectOk(await w.admin.put(`/v1/suppliers/${s[key].id}/accreditation`).send({ accredited: true, accreditationNo: `ACC-${key}`, accreditationExpiry: '2027-12-31' }));
    }

    s.cementCat = await expectOk<Json>(await w.admin.post('/v1/item-categories').send({ name: uniq('Cementitious') }));
    s.cement = await expectOk<Json>(
      await w.admin.post('/v1/items').send({
        sku: uniq('CEM-40'), name: 'Portland Cement Type 1, 40kg', baseUnit: 'bag', categoryId: s.cementCat.id, preferredSupplierId: s.holcim.id,
        minStock: '200', reorderPoint: '400', maxStock: '5000', costingMethod: 'WEIGHTED_AVERAGE',
      }),
    );
    s.rebar = await expectOk<Json>(
      await w.admin.post('/v1/items').send({ sku: uniq('RB-16'), name: '16mm Deformed Bar Grade 40, 6m', baseUnit: 'pc', costingMethod: 'STANDARD', standardCost: '520' }),
    );
    s.warehouse = await expectOk<Json>(await w.admin.post('/v1/warehouses').send({ code: uniq('WH-LHG'), name: 'Lahug Site Warehouse', type: 'SITE', branchId: s.branch.id }));
    s.bin = await expectOk<Json>(await w.admin.post('/v1/warehouse-locations').send({ warehouseId: s.warehouse.id, level: 'ZONE', code: 'A' }));
    s.costCode = await expectOk<Json>(await w.admin.post('/v1/cost-codes').send({ code: uniq('03-300'), name: 'Cast-in-place concrete', category: 'MATERIAL' }));

    expect((await w.admin.get(`/v1/warehouses/${s.warehouse.id}`)).body).toMatchObject({ type: 'SITE', branch: { id: s.branch.id } });
    expect((await w.admin.get(`/v1/items/${s.cement.id}`)).body.preferredSupplier.id).toBe(s.holcim.id);
  });

  it('creates and activates the project, with WBS, an approved BOQ budget and a contract', async () => {
    s.project = await expectOk<Json>(
      await w.admin.post('/v1/projects').send({
        code: uniq('LHG-T2'), name: 'Tower 2, Lahug', customerId: s.customer.id, branchId: s.branch.id, managerId: w.users.pm, type: 'COMMERCIAL',
        location: 'Lahug, Cebu City', startDate: '2026-10-01', originalEndDate: '2028-03-31', contractAmount: '0',
      }),
    );
    expect((await w.admin.post(`/v1/projects/${s.project.id}/status`).send({ status: 'ACTIVE' })).body.status).toBe('ACTIVE');

    s.wbsRoot = await expectOk<Json>(await w.admin.post(`/v1/projects/${s.project.id}/wbs`).send({ code: '1', name: 'Substructure' }));
    s.wbs = await expectOk<Json>(await w.admin.post(`/v1/projects/${s.project.id}/wbs`).send({ code: '1.1', name: 'Foundation concrete', parentId: s.wbsRoot.id }));

    s.estimate = await expectOk<Json>(await w.admin.post(`/v1/projects/${s.project.id}/estimates`).send({ name: 'Approved estimate', overheadPct: '8', profitPct: '10', taxPct: '12' }));
    s.boqConcrete = await expectOk<Json>(
      await w.admin.post(`/v1/estimates/${s.estimate.id}/items`).send({
        itemNo: 'B-1.1', section: 'Substructure', description: 'Concrete, 4000 psi, foundation', unit: 'm3', quantity: '180', unitRate: '9250',
        wbsNodeId: s.wbs.id, costCodeId: s.costCode.id, costCategory: 'MATERIAL',
      }),
    );
    s.boqRebar = await expectOk<Json>(
      await w.admin.post(`/v1/estimates/${s.estimate.id}/items`).send({
        itemNo: 'B-1.2', description: 'Reinforcing steel', unit: 'kg', quantity: '22000', unitRate: '64', wbsNodeId: s.wbs.id, costCategory: 'MATERIAL',
      }),
    );
    const approved = await expectOk<{ budget: Json }>(await w.admin.post(`/v1/estimates/${s.estimate.id}/approve`).send({}));
    expect(approved.budget).toMatchObject({ version: 1, isCurrent: true, totalAmount: '3073000' });

    const contract = await expectOk<Json>(await w.admin.post(`/v1/projects/${s.project.id}/contracts`).send({ title: 'Main construction contract', originalAmount: '3500000' }));
    expect((await w.admin.post(`/v1/contracts/${contract.id}/activate`).send({})).status).toBe(200);
    expect((await w.admin.get(`/v1/projects/${s.project.id}/dashboard`)).body.financial).toMatchObject({
      contractValue: '3500000.00', contractValueSource: 'CONTRACT', committed: '0.00', actual: '0.00',
    });
  });

  it('raises a requisition that references WBS, cost code and BOQ, and has it approved', async () => {
    const created = await w.engineer.post('/v1/requisitions').send({
      projectId: s.project.id,
      warehouseId: s.warehouse.id,
      priority: 'HIGH',
      requiredDate: '2026-11-15',
      purpose: 'Foundation pour, grid A-C',
      lines: [
        { itemId: s.cement.id, qty: '1200', requiredDate: '2026-11-10', wbsNodeId: s.wbs.id, costCodeId: s.costCode.id, boqItemId: s.boqConcrete.id, estimatedUnitCost: '265', justification: 'Mat foundation pour' },
        { itemId: s.rebar.id, qty: '400', requiredDate: '2026-11-05', wbsNodeId: s.wbs.id, boqItemId: s.boqRebar.id },
      ],
    });
    expect(created.status).toBe(201);
    s.pr = created.body;
    s.lines = created.body.lines;
    // 1200 x 265 + 400 x 520 (standard cost) = 318,000 + 208,000
    expect(created.body.estimatedTotal).toBe('526000');

    const submit = await w.engineer.post(`/v1/requisitions/${s.pr.id}/submit`).set('Idempotency-Key', idemKey('pr-submit')).send({});
    expect(submit.body.status).toBe('SUBMITTED');
    expect(submit.body.approvals[0]).toMatchObject({ totalSteps: 2, currentRole: 'Project Manager' });

    expect((await w.engineer.post(`/v1/requisitions/${s.pr.id}/approve`).set('Idempotency-Key', idemKey()).send({})).status).toBe(403);
    expect((await w.finance.post(`/v1/requisitions/${s.pr.id}/approve`).set('Idempotency-Key', idemKey()).send({})).status).toBe(403);
    expect((await w.pm.post(`/v1/requisitions/${s.pr.id}/approve`).set('Idempotency-Key', idemKey()).send({ comment: 'Scope confirmed with QS' })).body.status).toBe('SUBMITTED');
    const final = await w.finance.post(`/v1/requisitions/${s.pr.id}/approve`).set('Idempotency-Key', idemKey()).send({});
    expect(final.body).toMatchObject({ status: 'APPROVED' });
    expect(final.body.approvals[0].steps.map((x: Json) => x.state)).toEqual(['APPROVED', 'APPROVED']);
    s.pr = final.body;
  });

  it('sources the requisition through an RFQ to three suppliers and compares their quotations', async () => {
    const rfqCreated = await w.buyer.post('/v1/rfqs').send({
      requisitionId: s.pr.id,
      supplierIds: [s.holcim.id, s.republic.id, s.mactan.id],
      lines: s.lines.map((l) => ({ requisitionLineId: l.id })),
      dueDate: new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10),
      deliveryRequirements: 'Delivered and unloaded at Lahug site, Mon-Sat 7am-4pm',
      remarks: 'Foundation package',
    });
    expect(rfqCreated.status).toBe(201);
    s.rfq = rfqCreated.body;
    expect((await w.buyer.post(`/v1/rfqs/${s.rfq.id}/send`).send({})).body.status).toBe('SENT');
    const rfqLines = (s.rfq.lines as Json[]).map((l) => l.id);
    const quote = (supplier: Json, lines: Array<Record<string, unknown>>, extra: Record<string, unknown>) =>
      w.buyer.post(`/v1/rfqs/${s.rfq.id}/quotations`).send({ supplierId: supplier.id, quoteDate: '2026-10-08', validUntil: '2026-12-31', lines, ...extra });

    s.qHolcim = (await expectOk<Json>(await quote(s.holcim, [{ rfqLineId: rfqLines[0], unitPrice: '262', discountPct: '1.5', taxPct: '12', brand: 'Holcim' }], { deliveryDays: 5, paymentTerms: '30 days' })));
    s.qRepublic = (await expectOk<Json>(await quote(s.republic, [{ rfqLineId: rfqLines[0], unitPrice: '259', taxPct: '12', brand: 'Republic' }], { deliveryDays: 9, paymentTerms: '45 days' })));
    s.qMactan = (await expectOk<Json>(await quote(s.mactan, [{ rfqLineId: rfqLines[1], unitPrice: '515.75', taxPct: '12', deliveryDate: '2026-10-30' }], { deliveryDays: 7, paymentTerms: 'COD' })));

    const cmp = await w.buyer.get(`/v1/rfqs/${s.rfq.id}/comparison`);
    expect(cmp.status).toBe(200);
    const cement = (cmp.body.lines as Array<{ offers: Json[]; lowestNetUnitPrice: string }>)[0]!;
    // Holcim 262 less 1.5% = 258.07 beats Republic at 259; Holcim is also the preferred supplier and the fastest.
    expect(cement.lowestNetUnitPrice).toBe('258.07');
    const holcim = cement.offers.find((o) => o.supplierId === s.holcim.id)!;
    const republic = cement.offers.find((o) => o.supplierId === s.republic.id)!;
    expect(holcim).toMatchObject({ isLowestPrice: true, isFastestDelivery: true, isPreferredSupplier: true, varianceFromLowestPct: '0' });
    expect(republic).toMatchObject({ isLowestPrice: false, isFastestDelivery: false, varianceFromLowestPct: '0.36' });
    const bar = (cmp.body.lines as Array<{ offers: Json[] }>)[1]!;
    expect(bar.offers).toHaveLength(1);
    expect(bar.offers[0]).toMatchObject({ isLowestPrice: true, supplierId: s.mactan.id });
    expect((cmp.body.suppliers as Json[]).filter((x) => x.coversAllLines)).toHaveLength(0);
  });

  it('awards split sourcing: cement RFQ goes to Holcim (partial quote), steel is re-sourced to Mactan on a second RFQ', async () => {
    // The award is whole-quotation by design; Holcim's quote covers the cement line only.
    const award = await w.buyer.post(`/v1/rfqs/${s.rfq.id}/award`).set('Idempotency-Key', idemKey('award')).send({ quotationId: s.qHolcim.id, reason: 'Lowest net price, preferred supplier' });
    expect(award.status).toBe(200);
    expect(award.body).toMatchObject({ status: 'AWARDED', awardedQuotationId: s.qHolcim.id });
    expect(award.body.award).toMatchObject({ supplierId: s.holcim.id });

    const steelRfq = await expectOk<Json>(
      await w.buyer.post('/v1/rfqs').send({
        requisitionId: s.pr.id, supplierIds: [s.mactan.id], lines: [{ requisitionLineId: s.lines[1]!.id }],
        dueDate: new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10), remarks: 'Steel package',
      }),
    );
    await w.buyer.post(`/v1/rfqs/${steelRfq.id}/send`).send({});
    s.qSteel = await expectOk<Json>(
      await w.buyer.post(`/v1/rfqs/${steelRfq.id}/quotations`).send({
        supplierId: s.mactan.id, quoteDate: '2026-10-09', validUntil: '2026-12-31', deliveryDays: 7, paymentTerms: 'COD',
        lines: [{ rfqLineId: (steelRfq.lines as Json[])[0]!.id, unitPrice: '515.75', taxPct: '12', deliveryDate: '2026-10-30' }],
      }),
    );
    await expectOk(await w.buyer.post(`/v1/rfqs/${steelRfq.id}/award`).set('Idempotency-Key', idemKey('award')).send({ quotationId: s.qSteel.id }));
    s.steelRfq = steelRfq;
    expect((await w.buyer.get('/v1/rfqs').query({ requisitionId: s.pr.id, status: 'AWARDED' })).body.items).toHaveLength(2);
  });

  it('raises purchase orders from the awarded quotations, approves and sends them', async () => {
    const poKey = idemKey('po-cement');
    const create = await w.buyer.post('/v1/purchase-orders').set('Idempotency-Key', poKey).send({ source: 'QUOTATION', quotationId: s.qHolcim.id, deliveryLocation: 'Lahug site' });
    expect(create.status).toBe(201);
    s.po = create.body;
    // 1200 x 262 = 314,400; less 1.5% = 4,716 -> 309,684; tax 12% = 37,162.08
    expect(create.body).toMatchObject({ status: 'DRAFT', subtotal: '314400', discount: '4716', taxAmount: '37162.08', totalAmount: '346846.08', supplier: { id: s.holcim.id } });
    const replay = await w.buyer.post('/v1/purchase-orders').set('Idempotency-Key', poKey).send({ source: 'QUOTATION', quotationId: s.qHolcim.id, deliveryLocation: 'Lahug site' });
    expect(replay.headers['idempotent-replayed']).toBe('true');
    expect(replay.body.id).toBe(s.po.id);

    s.poSteel = await expectOk<Json>(await w.buyer.post('/v1/purchase-orders').set('Idempotency-Key', idemKey('po-steel')).send({ source: 'QUOTATION', quotationId: s.qSteel.id }));
    // 400 x 515.75 = 206,300; tax 24,756
    expect(s.poSteel).toMatchObject({ totalAmount: '231056' });

    for (const po of [s.po, s.poSteel]) {
      const submit = await w.buyer.post(`/v1/purchase-orders/${po.id}/submit`).set('Idempotency-Key', idemKey('po-sub')).send({});
      expect(submit.body.status).toBe('PENDING_APPROVAL');
      expect((await w.buyer.post(`/v1/purchase-orders/${po.id}/approve`).set('Idempotency-Key', idemKey()).send({})).status).toBe(403);
      const approved = await w.finance.post(`/v1/purchase-orders/${po.id}/approve`).set('Idempotency-Key', idemKey('po-apr')).send({ comment: 'Within budget' });
      expect(approved.body).toMatchObject({ status: 'APPROVED' });
      expect((await w.buyer.post(`/v1/purchase-orders/${po.id}/send`).send({})).body.status).toBe('SENT');
    }
    s.po = (await w.buyer.get(`/v1/purchase-orders/${s.po.id}`)).body;
    s.poSteel = (await w.buyer.get(`/v1/purchase-orders/${s.poSteel.id}`)).body;
  });

  it('leaves consistent, derivable state across requisition, supplier, item, project and ledgers', async () => {
    const pr = await w.pm.get(`/v1/requisitions/${s.pr.id}`);
    expect(pr.body.status).toBe('ORDERED');
    expect((pr.body.lines as Json[]).map((l) => [l.orderedQty, l.remainingQty])).toEqual([['1200', '0'], ['400', '0']]);
    expect(pr.body.purchaseOrders).toHaveLength(2);
    expect(pr.body.rfqs).toHaveLength(2);

    const perf = await w.admin.get(`/v1/suppliers/${s.holcim.id}/performance`);
    expect(perf.body.orders).toMatchObject({ count: 1, totalValue: '346846.08', openCount: 1 });
    expect(perf.body.sourcing).toMatchObject({ rfqsInvited: 1, quotationsSubmitted: 1, awards: 1, responseRatePct: '100.00', winRatePct: '100.00' });
    const lost = await w.admin.get(`/v1/suppliers/${s.republic.id}/performance`);
    expect(lost.body.sourcing).toMatchObject({ quotationsSubmitted: 1, awards: 0, winRatePct: '0.00' });

    const stock = await w.admin.get(`/v1/items/${s.cement.id}/stock`);
    expect(stock.body.totals).toMatchObject({ onHand: '0', committed: '1200', available: '0' });
    const prices = await w.admin.get(`/v1/items/${s.cement.id}/price-history`);
    expect(prices.body.items.map((p: Json & { supplier: { id: string } }) => [p.source, p.supplier.id === s.holcim.id || p.supplier.id === s.republic.id])).toEqual(
      expect.arrayContaining([['QUOTATION', true], ['PURCHASE_ORDER', true]]),
    );

    const dashboard = await w.admin.get(`/v1/projects/${s.project.id}/dashboard`);
    // committed = remaining value of both approved POs, freight excluded: 346,846.08 + 231,056
    expect(dashboard.body.financial).toMatchObject({ committed: '577902.08', actual: '0.00' });
    expect(dashboard.body.counts).toMatchObject({ openPurchaseOrders: 2, wbsNodes: 2, boqItems: 2 });

    // Procurement alone never touches the stock or project cost ledgers; receipts and issues do that.
    expect(await ctx.prisma.stockLedger.count({ where: { companyId: w.company.id } })).toBe(0);
    expect(await ctx.prisma.projectCostLedger.count({ where: { companyId: w.company.id } })).toBe(0);
  });

  it('keeps a complete audit and activity trail for every document in the chain', async () => {
    const prTrail = await w.pm.get(`/v1/requisitions/${s.pr.id}/activity`);
    expect(prTrail.body.map((t: { action: string }) => t.action)).toEqual(['CREATE', 'SUBMIT', 'APPROVED', 'APPROVED', 'STATUS_CHANGE']);
    const poTrail = await w.buyer.get(`/v1/purchase-orders/${s.po.id}/activity`);
    expect(poTrail.body.map((t: { action: string }) => t.action)).toEqual(['CREATE', 'SUBMIT', 'APPROVED', 'STATUS_CHANGE', 'SEND']);
    expect(poTrail.body.every((t: { actor: { name: string } | null; action: string }) => t.actor !== null || t.action === 'STATUS_CHANGE')).toBe(true);
    const rfqTrail = await w.buyer.get(`/v1/rfqs/${s.rfq.id}/activity`);
    expect(rfqTrail.body.map((t: { action: string }) => t.action)).toEqual(['CREATE', 'SEND', 'QUOTATION_RECEIVED', 'QUOTATION_RECEIVED', 'QUOTATION_RECEIVED', 'AWARD']);
    const audits = await ctx.prisma.auditLog.count({ where: { companyId: w.company.id, entityType: { in: ['PURCHASE_REQUISITION', 'RFQ', 'PURCHASE_ORDER'] } } });
    expect(audits).toBeGreaterThanOrEqual(20);
  });

  it('a rival company can read or change none of it', async () => {
    const ids: Array<[string, string]> = [
      ['projects', s.project.id as string], ['requisitions', s.pr.id as string], ['rfqs', s.rfq.id as string],
      ['purchase-orders', s.po.id as string], ['quotations', s.qHolcim.id as string], ['suppliers', s.holcim.id as string],
      ['items', s.cement.id as string], ['customers', s.customer.id as string], ['warehouses', s.warehouse.id as string],
    ];
    for (const [path, id] of ids) expect((await rival.admin.get(`/v1/${path}/${id}`)).status, path).toBe(404);
    expect((await rival.admin.post(`/v1/purchase-orders/${s.po.id}/cancel`).send({ reason: 'sabotage' })).status).toBe(404);
    expect((await rival.admin.get(`/v1/rfqs/${s.rfq.id}/comparison`)).status).toBe(404);
    expect((await rival.admin.get('/v1/purchase-orders')).body.items).toHaveLength(0);
    expect((await ctx.http().get(`/v1/purchase-orders/${s.po.id}`)).status).toBe(401);
  });

  // ---- Stage F: goods receipt + QC -------------------------------------------------------------------------------------

  const line0 = (po: Json): string => (po.lines as Json[])[0]!.id as string;
  const dec2 = (n: number): string => n.toFixed(2);

  it('prepares warehouse staff, a QC-authorised manager and the material request workflow', async () => {
    a = await stockActors(w);
    site = (await userAgent(w, ['Site Engineer'])).agent;
    await setWorkflow(w.admin, 'MATERIAL_REQUEST', [{ minAmount: '0', steps: ['Project Manager'] }]);
    const receivable = await a.ws.get(`/v1/purchase-orders/${s.po.id}/receivable-lines`);
    expect(receivable.status).toBe(200);
    expect(receivable.body.lines[0]).toMatchObject({ ordered: '1200', previouslyReceived: '0', remaining: '1200' });
  });

  it('blocks over-receipt: no override, no permission, and not beyond the tolerance', async () => {
    const over = await expectOk<Json & { lines: Json[] }>(
      await a.ws.post('/v1/goods-receipts').send({ orderId: s.po.id, lines: [{ orderLineId: line0(s.po), receivedQty: '1400', locationId: s.bin.id }] }),
      201,
    );
    expect(over.lines[0]).toMatchObject({ ordered: '1200', remaining: '1200', receivingNow: '1400', overReceiving: true });
    const plain = await a.ws.post(`/v1/goods-receipts/${over.id}/post`).set('Idempotency-Key', idemKey()).send({});
    expect(plain.status).toBe(422);
    expect(plain.body.detail).toMatch(/Over-receipt needs an authorised override/);
    expect((await a.ws.post(`/v1/goods-receipts/${over.id}/post`).set('Idempotency-Key', idemKey()).send({ overReceipt: { reason: 'Extra trucks arrived' } })).status).toBe(403);
    const beyond = await a.wm.post(`/v1/goods-receipts/${over.id}/post`).set('Idempotency-Key', idemKey()).send({ overReceipt: { reason: 'Extra trucks arrived' } });
    expect(beyond.status).toBe(422);
    expect(beyond.body.detail).toMatch(/tolerance/);
    expect((await a.wm.post(`/v1/goods-receipts/${over.id}/cancel`).set('Idempotency-Key', idemKey()).send({ reason: 'Refused at the gate' })).body.status).toBe('CANCELLED');
    expect(await ctx.prisma.stockLedger.count({ where: { companyId: w.company.id } })).toBe(0);
  });

  it('receives the first partial delivery of cement, inspects it, and posts accepted and quarantined stock', async () => {
    const grn = await expectOk<Json & { lines: Json[] }>(
      await a.ws.post('/v1/goods-receipts').send({
        orderId: s.po.id, supplierDrNo: 'HOL-DR-88121', vehicle: 'GAB 4421', driver: 'R. Villanueva',
        lines: [{ orderLineId: line0(s.po), receivedQty: '700', locationId: s.bin.id }],
      }),
      201,
    );
    expect(grn).toMatchObject({ status: 'DRAFT', supplierDrNo: 'HOL-DR-88121' });
    expect(grn.lines[0]).toMatchObject({ ordered: '1200', previouslyReceived: '0', remaining: '1200', receivingNow: '700', unit: 'bag' });
    s.grn1 = grn;

    const lineId = grn.lines[0]!.id as string;
    const qc = { outcome: 'PARTIAL', acceptedQty: '650', rejectedQty: '20', quarantineQty: '30', reason: 'Torn bags rejected; wet bags held for strength test', certificateNo: 'HOL-COA-2026-441' };
    expect((await a.ws.put(`/v1/goods-receipts/${grn.id}/lines/${lineId}/inspection`).send(qc)).status).toBe(403);
    expect((await w.viewer.put(`/v1/goods-receipts/${grn.id}/lines/${lineId}/inspection`).send(qc)).status).toBe(403);
    expect((await a.wm.put(`/v1/goods-receipts/${grn.id}/lines/${lineId}/inspection`).send({ ...qc, acceptedQty: '600' })).status).toBe(422);
    await expectOk(await a.wm.put(`/v1/goods-receipts/${grn.id}/lines/${lineId}/inspection`).send(qc), 200);

    expect((await w.viewer.post(`/v1/goods-receipts/${grn.id}/post`).set('Idempotency-Key', idemKey()).send({})).status).toBe(403);
    const key = idemKey('grn1');
    const posted = await a.ws.post(`/v1/goods-receipts/${grn.id}/post`).set('Idempotency-Key', key).send({});
    expect(posted.status).toBe(200);
    expect(posted.body.lines[0]).toMatchObject({ acceptedQty: '650', rejectedQty: '20', quarantineQty: '30', qcResult: 'PARTIAL', unitCost: '258.07' });
    expect((await a.ws.post(`/v1/goods-receipts/${grn.id}/post`).set('Idempotency-Key', key).send({})).headers['idempotent-replayed']).toBe('true');
    expect((await a.ws.post(`/v1/goods-receipts/${grn.id}/post`).set('Idempotency-Key', idemKey()).send({})).status).toBe(422);
    s.grn1 = posted.body;
  });

  it('verifies stock, PO quantities, last purchase cost and committed cost after the partial receipt', async () => {
    // accepted 650 AVAILABLE at 258.07 (1,200 bags cost 309,684 net of discount); 30 held in QUARANTINE; 20 rejected are not stocked
    const stock = await a.wm.get(`/v1/items/${s.cement.id}/stock`);
    expect(stock.body.totals).toMatchObject({ onHand: '650', reserved: '0', committed: '520', available: '650' });
    expect(stock.body.warehouses[0]).toMatchObject({ onHand: '650', quarantine: '30' });
    const row = (await a.wm.get('/v1/inventory/stock-balances').query({ itemId: s.cement.id })).body.items[0];
    expect(row).toMatchObject({ onHand: '650', quarantine: '30', committed: '520', avgCost: '258.07' });
    expect(row.locations[0]).toMatchObject({ qty: '650' });
    expect(Number(row.availableValue)).toBeCloseTo(650 * 258.07, 2);
    expect(Number(row.value)).toBeCloseTo(680 * 258.07, 2);

    const po = (await w.buyer.get(`/v1/purchase-orders/${s.po.id}`)).body;
    expect(po.status).toBe('PARTIALLY_RECEIVED');
    expect(po.lines[0]).toMatchObject({ receivedQty: '680', openQty: '520' });
    expect(po.receipts).toHaveLength(2);
    expect((await w.admin.get(`/v1/items/${s.cement.id}`)).body.lastPurchaseCost).toBe('258.07');

    const dash = (await w.admin.get(`/v1/projects/${s.project.id}/dashboard`)).body.financial;
    // committed = open PO value not yet received: 520/1200 of 346,846.08 plus the whole steel PO (231,056)
    expect(Number(dash.committed)).toBeCloseTo((346846.08 * 520) / 1200 + 231056, 2);
    expect(dash.actual).toBe('0.00');
    // receiving is inventory, not project cost
    expect(await ctx.prisma.projectCostLedger.count({ where: { companyId: w.company.id } })).toBe(0);
    const ledger = await ctx.prisma.stockLedger.findMany({ where: { companyId: w.company.id, itemId: s.cement.id as string }, orderBy: { createdAt: 'asc' } });
    expect(ledger.map((r) => [r.stockStatus, r.qty.toString()]).sort()).toEqual([['AVAILABLE', '650'], ['QUARANTINE', '30']]);
    expect(ledger.every((r) => r.projectId === s.project.id && r.locationId === s.bin.id)).toBe(true);
  });

  it('releases the quarantined bags after the strength test', async () => {
    const lineId = (s.grn1.lines as Json[])[0]!.id as string;
    expect((await a.ws.post(`/v1/goods-receipts/${s.grn1.id}/lines/${lineId}/quarantine-decision`).set('Idempotency-Key', idemKey()).send({ outcome: 'PASS' })).status).toBe(403);
    const released = await a.wm.post(`/v1/goods-receipts/${s.grn1.id}/lines/${lineId}/quarantine-decision`).set('Idempotency-Key', idemKey()).send({ outcome: 'PASS', remarks: 'Strength test passed' });
    expect(released.status).toBe(200);
    expect(released.body.lines[0]).toMatchObject({ acceptedQty: '680', quarantineQty: '0', rejectedQty: '20' });
    expect((await a.wm.get(`/v1/items/${s.cement.id}/stock`)).body.totals).toMatchObject({ onHand: '680', committed: '520' });
    expect((await a.wm.get(`/v1/items/${s.cement.id}/stock`)).body.warehouses[0]).toMatchObject({ quarantine: '0' });
  });

  it('receives the remainder of the cement and the whole steel order, completing both purchase orders', async () => {
    const grn2 = await expectOk<Json & { lines: Json[] }>(
      await a.ws.post('/v1/goods-receipts').send({ orderId: s.po.id, lines: [{ orderLineId: line0(s.po), receivedQty: '520', locationId: s.bin.id }] }),
      201,
    );
    expect(grn2.lines[0]).toMatchObject({ previouslyReceived: '680', remaining: '520', receivingNow: '520' });
    await expectOk(await a.ws.post(`/v1/goods-receipts/${grn2.id}/post`).set('Idempotency-Key', idemKey()).send({}), 200);
    const steel = await expectOk<Json & { lines: Json[] }>(
      await a.ws.post('/v1/goods-receipts').send({ orderId: s.poSteel.id, supplierDrNo: 'MST-5521', lines: [{ orderLineId: line0(s.poSteel), receivedQty: '400', locationId: s.bin.id }] }),
      201,
    );
    await expectOk(await a.ws.post(`/v1/goods-receipts/${steel.id}/post`).set('Idempotency-Key', idemKey()).send({}), 200);

    for (const po of [s.po, s.poSteel]) expect((await w.buyer.get(`/v1/purchase-orders/${po.id}`)).body.status).toBe('RECEIVED');
    expect(await a.wm.get(`/v1/items/${s.cement.id}/stock`).then((r) => r.body.totals)).toMatchObject({ onHand: '1200', committed: '0', available: '1200' });
    expect(await a.wm.get(`/v1/items/${s.rebar.id}/stock`).then((r) => r.body.totals)).toMatchObject({ onHand: '400', committed: '0' });
    expect(Number((await a.wm.get(`/v1/items/${s.cement.id}/stock`)).body.totals.value)).toBeCloseTo(1200 * 258.07, 2);
    expect((await a.wm.get(`/v1/items/${s.rebar.id}/stock`)).body.totals.value).toBe('206300');
    expect((await w.admin.get(`/v1/items/${s.rebar.id}`)).body.lastPurchaseCost).toBe('515.75');
    const dash = (await w.admin.get(`/v1/projects/${s.project.id}/dashboard`)).body.financial;
    expect(dash).toMatchObject({ committed: '0.00', actual: '0.00' });
    // nothing is left to receive
    const again = await a.ws.post('/v1/goods-receipts').send({ orderId: s.po.id, lines: [{ orderLineId: line0(s.po), receivedQty: '1' }] });
    expect(again.status).toBe(422);

    const perf = await w.admin.get(`/v1/suppliers/${s.holcim.id}/performance`);
    expect(Number(perf.body.quality.rejectedQty)).toBe(20);
    expect(Number(perf.body.quality.receivedQty)).toBe(1220);
    // the refused over-receipt draft was cancelled; the two real deliveries are posted
    expect((await w.buyer.get(`/v1/purchase-orders/${s.po.id}`)).body.receipts.map((r: Json) => r.status).sort()).toEqual(['CANCELLED', 'POSTED', 'POSTED']);
  });

  // ---- Stage H: material request ---------------------------------------------------------------------------------------

  it('raises a material request for the foundation pour and has it approved with a reduced quantity', async () => {
    const created = await expectOk<Json & { lines: Json[] }>(
      await w.engineer.post('/v1/material-requests').send({
        projectId: s.project.id, warehouseId: s.warehouse.id, neededDate: '2026-11-20', purpose: 'Mat foundation pour, grid A-C',
        lines: [
          { itemId: s.cement.id, qty: '300', wbsNodeId: s.wbs.id, costCodeId: s.costCode.id, boqItemId: s.boqConcrete.id, purpose: 'Concrete mix' },
          { itemId: s.rebar.id, qty: '100', wbsNodeId: s.wbs.id, boqItemId: s.boqRebar.id, purpose: 'Starter bars' },
        ],
      }),
      201,
    );
    s.mr = created;
    const key = idemKey('mr-sub');
    const submitted = await w.engineer.post(`/v1/material-requests/${created.id}/submit`).set('Idempotency-Key', key).send({});
    expect(submitted.body).toMatchObject({ status: 'SUBMITTED' });
    expect(submitted.body.approvals[0]).toMatchObject({ totalSteps: 1, currentRole: 'Project Manager' });
    expect((await w.engineer.post(`/v1/material-requests/${created.id}/submit`).set('Idempotency-Key', key).send({})).headers['idempotent-replayed']).toBe('true');
    expect((await w.engineer.post(`/v1/material-requests/${created.id}/submit`).set('Idempotency-Key', idemKey()).send({})).status).toBe(422);

    // unauthorized approval: the requester, the buyer and finance may not decide; quantities stay untouched
    for (const who of [w.engineer, w.buyer, w.finance, a.wm]) {
      const res = await who.post(`/v1/material-requests/${created.id}/approve`).set('Idempotency-Key', idemKey()).send({ lines: [{ lineId: created.lines[0]!.id, approvedQty: '1' }] });
      expect(res.status).toBe(403);
    }
    expect((await w.pm.get(`/v1/material-requests/${created.id}`)).body.lines[0].approvedQty).toBe('300');
    const approved = await w.pm.post(`/v1/material-requests/${created.id}/approve`).set('Idempotency-Key', idemKey('mr-apr')).send({
      comment: 'Cement reduced: 50 bags still on the pallet', lines: [{ lineId: created.lines[0]!.id, approvedQty: '250' }],
    });
    expect(approved.body.status).toBe('APPROVED');
    expect(approved.body.lines.map((l: Json) => [l.qty, l.approvedQty, l.issuedQty, l.remainingQty])).toEqual([['300', '250', '0', '250'], ['100', '100', '0', '100']]);
    s.mr = approved.body;
    // approved quantity is reserved and shows in availability
    expect(await a.wm.get(`/v1/items/${s.cement.id}/stock`).then((r) => r.body.totals)).toMatchObject({ onHand: '1200', reserved: '250', available: '950' });
    expect(await a.wm.get(`/v1/items/${s.rebar.id}/stock`).then((r) => r.body.totals)).toMatchObject({ onHand: '400', reserved: '100', available: '300' });
    expect((await w.pm.post(`/v1/material-requests/${created.id}/approve`).set('Idempotency-Key', idemKey()).send({})).status).toBe(422);
  });

  // ---- Stage I: material issue + project cost ----------------------------------------------------------------------------

  it('refuses over-issue and unauthorised issues', async () => {
    const mrLines = s.mr.lines as Json[];
    const over = await a.ws.post('/v1/material-issues').send({ requestId: s.mr.id, lines: [{ requestLineId: mrLines[0]!.id, qty: '251' }] });
    expect(over.status).toBe(422);
    expect(over.body.errors[0].message).toMatch(/only 250/);
    // direct issues (no request) need the OVERRIDE permission; site staff and finance cannot issue at all
    expect((await a.ws.post('/v1/material-issues').send({ projectId: s.project.id, warehouseId: s.warehouse.id, remarks: 'Urgent', lines: [{ itemId: s.cement.id, qty: '1' }] })).status).toBe(403);
    expect((await w.finance.post('/v1/material-issues').send({ requestId: s.mr.id })).status).toBe(403);
    expect((await site.post('/v1/material-issues').send({ requestId: s.mr.id })).status).toBe(403);
    expect((await ctx.http().post('/v1/material-issues').send({ requestId: s.mr.id })).status).toBe(401);
    const wrongWbs = await a.wm.post('/v1/material-issues').send({
      requestId: s.mr.id, lines: [{ requestLineId: mrLines[0]!.id, qty: '1', wbsNodeId: '00000000-0000-4000-8000-000000000000' }],
    });
    expect(wrongWbs.status).toBe(422);
    expect(await ctx.prisma.stockLedger.count({ where: { companyId: w.company.id, txnType: 'PROJECT_ISSUE' } })).toBe(0);
  });

  it('issues the approved material: inventory, project cost ledger and request quantities change together', async () => {
    const draft = await expectOk<Json & { lines: Json[] }>(await a.ws.post('/v1/material-issues').send({ requestId: s.mr.id, receivedBy: 'Foreman A. Reyes', vehicle: 'Dump truck 7', remarks: 'Foundation pour' }), 201);
    expect(draft.number).toMatch(/^MIV-/);
    expect(draft.lines.map((l) => l.qty)).toEqual(['250', '100']);
    s.issue = draft;
    const key = idemKey('miv');
    const posted = await a.ws.post(`/v1/material-issues/${draft.id}/post`).set('Idempotency-Key', key).send({});
    expect(posted.status).toBe(200);
    // cement at weighted average 258.07, rebar at its STANDARD cost 520
    expect(posted.body.status).toBe('POSTED');
    expect(posted.body.lines.map((l: Json) => [l.unitCost, l.totalCost])).toEqual([['258.07', '64517.5'], ['520', '52000']]);
    expect(posted.body.totalCost).toBe('116517.5');
    s.issue = posted.body;
    expect((await a.ws.post(`/v1/material-issues/${draft.id}/post`).set('Idempotency-Key', key).send({})).headers['idempotent-replayed']).toBe('true');
    expect((await a.ws.post(`/v1/material-issues/${draft.id}/post`).set('Idempotency-Key', idemKey()).send({})).status).toBe(422);

    // inventory
    expect(await a.wm.get(`/v1/items/${s.cement.id}/stock`).then((r) => r.body.totals)).toMatchObject({ onHand: '950', reserved: '0', available: '950' });
    expect(await a.wm.get(`/v1/items/${s.rebar.id}/stock`).then((r) => r.body.totals)).toMatchObject({ onHand: '300', reserved: '0' });
    const mr = (await w.pm.get(`/v1/material-requests/${s.mr.id}`)).body;
    expect(mr.lines.map((l: Json) => [l.qty, l.approvedQty, l.issuedQty, l.remainingQty])).toEqual([['300', '250', '250', '0'], ['100', '100', '100', '0']]);
    // project cost ledger: one row per issue line with every dimension
    const costs = await ctx.prisma.projectCostLedger.findMany({ where: { companyId: w.company.id }, orderBy: { totalCost: 'desc' } });
    expect(costs).toHaveLength(2);
    expect(costs[0]).toMatchObject({
      projectId: s.project.id, wbsNodeId: s.wbs.id, boqItemId: s.boqConcrete.id, costCodeId: s.costCode.id, itemId: s.cement.id, warehouseId: s.warehouse.id,
      branchId: s.branch.id, txnType: 'MATERIAL_ISSUE', sourceType: 'MATERIAL_ISSUE', sourceId: draft.id, userId: a.wsId, costCategory: 'MATERIAL',
    });
    expect([costs[0]!.quantity.toString(), costs[0]!.unitCost.toString(), costs[0]!.totalCost.toString()]).toEqual(['250', '258.07', '64517.5']);
    expect(costs[1]).toMatchObject({ itemId: s.rebar.id, boqItemId: s.boqRebar.id, costCodeId: null, wbsNodeId: s.wbs.id });
    expect(costs[1]!.totalCost.toString()).toBe('52000');
    const stockRows = await ctx.prisma.stockLedger.findMany({ where: { companyId: w.company.id, txnType: 'PROJECT_ISSUE' } });
    expect(stockRows).toHaveLength(2);
    expect(stockRows.every((r) => r.sourceId === draft.id && r.projectId === s.project.id && r.userId === a.wsId)).toBe(true);

    // project dashboard and budget vs actual use the real ledger
    const dash = (await w.admin.get(`/v1/projects/${s.project.id}/dashboard`)).body.financial;
    expect(dash).toMatchObject({ actual: '116517.50', committed: '0.00' });
    const bva = (await w.admin.get(`/v1/projects/${s.project.id}/budget-vs-actual`)).body;
    expect(bva.totals).toMatchObject({ budget: '3073000.00', committed: '0.00', actual: '116517.50', variance: dec2(3073000 - 116517.5) });
    const concrete = bva.lines.find((l: Json & { costCode: Json | null }) => l.costCode?.id === s.costCode.id);
    expect(concrete).toMatchObject({ budget: '1665000.00', actual: '64517.50', variance: dec2(1665000 - 64517.5) });
    expect(bva.lines.find((l: Json & { costCode: Json | null }) => l.costCode === null)).toMatchObject({ budget: '1408000.00', actual: '52000.00' });
  });

  it('returns surplus cement in good condition and credits the project cost', async () => {
    const issueLine = (s.issue.lines as Json[])[0]!;
    const ret = await expectOk<Json>(
      await a.ws.post('/v1/material-returns').send({ issueId: s.issue.id, reason: 'Pour finished with bags to spare', lines: [{ issueLineId: issueLine.id, qty: '10', condition: 'GOOD' }] }),
      201,
    );
    expect((await a.ws.post(`/v1/material-returns/${ret.id}/post`).set('Idempotency-Key', idemKey()).send({})).body.status).toBe('POSTED');
    expect(await a.wm.get(`/v1/items/${s.cement.id}/stock`).then((r) => r.body.totals)).toMatchObject({ onHand: '960' });
    const dash = (await w.admin.get(`/v1/projects/${s.project.id}/dashboard`)).body.financial;
    expect(dash.actual).toBe('113936.80');
    const credit = await ctx.prisma.projectCostLedger.findFirstOrThrow({ where: { companyId: w.company.id, sourceType: 'MATERIAL_RETURN' } });
    expect([credit.txnType, credit.totalCost.toString(), credit.quantity.toString()]).toEqual(['MATERIAL_RETURN', '-2580.7', '-10']);
  });

  // ---- Stage J: cross-cutting checks ---------------------------------------------------------------------------------------

  it('handles a concurrent issue and receipt, and refuses a concurrent over-draw', async () => {
    // a third cement order, raised through the same workflows as the first
    const supplier = s.holcim.id as string;
    const pr = await expectOk<Json & { lines: Json[] }>(await w.engineer.post('/v1/requisitions').send({ projectId: s.project.id, warehouseId: s.warehouse.id, lines: [{ itemId: s.cement.id, qty: '100', wbsNodeId: s.wbs.id, costCodeId: s.costCode.id, boqItemId: s.boqConcrete.id, estimatedUnitCost: '258.07' }] }), 201);
    await w.engineer.post(`/v1/requisitions/${pr.id}/submit`).set('Idempotency-Key', idemKey()).send({});
    await expectOk(await w.pm.post(`/v1/requisitions/${pr.id}/approve`).set('Idempotency-Key', idemKey()).send({}), 200);
    const po3 = await expectOk<Json>(
      await w.buyer.post('/v1/purchase-orders').set('Idempotency-Key', idemKey()).send({ source: 'REQUISITION', requisitionId: pr.id, supplierId: supplier, lines: [{ requisitionLineId: pr.lines[0]!.id, qty: '100', unitPrice: '270' }] }),
      201,
    );
    await w.buyer.post(`/v1/purchase-orders/${po3.id}/submit`).set('Idempotency-Key', idemKey()).send({});
    await expectOk(await w.finance.post(`/v1/purchase-orders/${po3.id}/approve`).set('Idempotency-Key', idemKey()).send({}), 200);
    const po3Detail = (await w.buyer.get(`/v1/purchase-orders/${po3.id}`)).body as Json & { lines: Json[]; status: string };
    expect(po3Detail.status).toBe('APPROVED');
    const grn3 = await expectOk<Json>(await a.ws.post('/v1/goods-receipts').send({ orderId: po3.id, lines: [{ orderLineId: po3Detail.lines[0]!.id, receivedQty: '100', locationId: s.bin.id }] }), 201);

    const direct = (qty: string) => a.wm.post('/v1/material-issues').send({ projectId: s.project.id, warehouseId: s.warehouse.id, remarks: 'Slab pour, level 2', lines: [{ itemId: s.cement.id, qty, wbsNodeId: s.wbs.id, costCodeId: s.costCode.id }] });
    const issue = await expectOk<Json>(await direct('400'), 201);
    const [r1, r2] = await Promise.all([
      a.ws.post(`/v1/goods-receipts/${grn3.id}/post`).set('Idempotency-Key', idemKey()).send({}),
      a.wm.post(`/v1/material-issues/${issue.id}/post`).set('Idempotency-Key', idemKey()).send({}),
    ]);
    expect([r1.status, r2.status]).toEqual([200, 200]);
    expect(await a.wm.get(`/v1/items/${s.cement.id}/stock`).then((r) => r.body.totals)).toMatchObject({ onHand: '660' });

    // 660 on hand: two simultaneous issues of 400 cannot both succeed
    const [i1, i2] = [await expectOk<Json>(await direct('400'), 201), await expectOk<Json>(await direct('400'), 201)];
    const race = await Promise.all([i1, i2].map((i) => a.wm.post(`/v1/material-issues/${i.id}/post`).set('Idempotency-Key', idemKey()).send({})));
    expect(race.map((r) => r.status).sort()).toEqual([200, 422]);
    expect(await a.wm.get(`/v1/items/${s.cement.id}/stock`).then((r) => r.body.totals)).toMatchObject({ onHand: '260' });
  });

  it('keeps tenants apart: a rival company can read or change none of the stock documents', async () => {
    const paths: Array<[string, string]> = [
      ['goods-receipts', s.grn1.id as string], ['material-requests', s.mr.id as string], ['material-issues', s.issue.id as string],
    ];
    for (const [path, id] of paths) {
      expect((await rival.admin.get(`/v1/${path}/${id}`)).status, path).toBe(404);
      expect((await rival.admin.get(`/v1/${path}/${id}/activity`)).status, path).toBe(404);
    }
    expect((await rival.admin.post(`/v1/material-issues/${s.issue.id}/cancel`).set('Idempotency-Key', idemKey()).send({ reason: 'sabotage attempt' })).status).toBe(404);
    expect((await rival.admin.post(`/v1/goods-receipts/${s.grn1.id}/cancel`).set('Idempotency-Key', idemKey()).send({ reason: 'sabotage attempt' })).status).toBe(404);
    expect((await rival.admin.post(`/v1/material-requests/${s.mr.id}/close`).send({ reason: 'sabotage attempt' })).status).toBe(404);
    expect((await rival.admin.get(`/v1/projects/${s.project.id}/budget-vs-actual`)).status).toBe(404);
    expect((await rival.admin.get(`/v1/purchase-orders/${s.po.id}/receivable-lines`)).status).toBe(404);
    for (const path of ['goods-receipts', 'material-requests', 'material-issues', 'material-returns', 'inventory/stock-balances', 'inventory/movements']) {
      expect((await rival.admin.get(`/v1/${path}`)).body.items, path).toHaveLength(0);
    }
    expect((await rival.admin.get(`/v1/items/${s.cement.id}/stock`)).status).toBe(404);
    expect((await rival.admin.get('/v1/inventory/valuation')).body.rows).toHaveLength(0);
    // and no stock row of ours leaked into theirs
    expect(await ctx.prisma.stockLedger.count({ where: { companyId: rival.company.id } })).toBe(0);
  });

  it('refuses invalid transitions on every document', async () => {
    expect((await a.wm.post(`/v1/goods-receipts/${s.grn1.id}/post`).set('Idempotency-Key', idemKey()).send({})).status).toBe(422);
    // stock from the first receipt was partly issued: reversing it is blocked
    const blocked = await a.wm.post(`/v1/goods-receipts/${s.grn1.id}/cancel`).set('Idempotency-Key', idemKey()).send({ reason: 'Wrong site entirely' });
    expect(blocked.status).toBe(422);
    expect(blocked.body.detail).toMatch(/already been used/);
    expect((await w.pm.post(`/v1/material-requests/${s.mr.id}/cancel`).send({ reason: 'Not needed any more' })).status).toBe(422);
    expect((await w.pm.post(`/v1/material-requests/${s.mr.id}/reject`).set('Idempotency-Key', idemKey()).send({ comment: 'Too late to reject' })).status).toBe(422);
    expect((await w.engineer.patch(`/v1/material-requests/${s.mr.id}`).send({ remarks: 'edit after approval' })).status).toBe(422);
    expect((await a.wm.patch(`/v1/material-issues/${s.issue.id}`).send({ remarks: 'edit after posting' })).status).toBe(422);
    const closed = await w.pm.post(`/v1/material-requests/${s.mr.id}/close`).send({ reason: 'Pour completed' });
    expect(closed.body.status).toBe('CLOSED');
    expect((await a.ws.post('/v1/material-issues').send({ requestId: s.mr.id })).status).toBe(422);
    expect((await w.pm.post(`/v1/material-requests/${s.mr.id}/close`).send({ reason: 'again' })).status).toBe(422);
    expect((await w.buyer.post(`/v1/purchase-orders/${s.po.id}/cancel`).send({ reason: 'Goods already received' })).status).toBe(422);
  });

  it('keeps a complete audit and activity trail for the receipt, request and issue', async () => {
    const grnTrail = await a.wm.get(`/v1/goods-receipts/${s.grn1.id}/activity`);
    expect(grnTrail.body.map((t: { action: string }) => t.action)).toEqual(['CREATE', 'QC_RECORDED', 'POST', 'QC_QUARANTINE_DECISION']);
    expect(grnTrail.body.every((t: { actor: { name: string } | null }) => t.actor !== null)).toBe(true);
    const mrTrail = await w.pm.get(`/v1/material-requests/${s.mr.id}/activity`);
    expect(mrTrail.body.map((t: { action: string }) => t.action)).toEqual(['CREATE', 'SUBMIT', 'QTY_ADJUSTED', 'APPROVED', 'STATUS_CHANGE', 'ISSUE_POSTED', 'CLOSE']);
    const issueTrail = await a.wm.get(`/v1/material-issues/${s.issue.id}/activity`);
    expect(issueTrail.body.map((t: { action: string }) => t.action)).toEqual(['CREATE', 'POST', 'RETURN_POSTED']);
    const poTrail = await w.buyer.get(`/v1/purchase-orders/${s.po.id}/activity`);
    expect(poTrail.body.map((t: { action: string }) => t.action)).toEqual(expect.arrayContaining(['RECEIPT_POSTED', 'STATUS_CHANGE']));

    const audits = await ctx.prisma.auditLog.findMany({ where: { companyId: w.company.id, entityType: { in: ['GOODS_RECEIPT', 'MATERIAL_REQUEST', 'MATERIAL_ISSUE', 'MATERIAL_RETURN'] } } });
    expect(audits.length).toBeGreaterThanOrEqual(20);
    // every business action has a user, except the status change an approval decision causes
    expect(audits.filter((r) => r.userId === null).every((r) => r.action === 'STATUS_CHANGE')).toBe(true);
    const post = audits.find((r) => r.entityType === 'MATERIAL_ISSUE' && r.entityId === s.issue.id && r.action === 'POST');
    expect(post?.userId).toBe(a.wsId);
    expect(post?.after).toMatchObject({ status: 'POSTED', projectId: s.project.id, totalCost: '116517.5' });
  });

  it('ends with balances that equal the ledger: reconciliation is clean and every bucket re-adds', async () => {
    const rec = await w.admin.get('/v1/inventory/reconciliation');
    expect(rec.status).toBe(200);
    expect(rec.body).toMatchObject({ clean: true, differences: [] });
    expect((await a.wm.get('/v1/inventory/reconciliation')).status).toBe(403);

    // independent re-derivation straight from the tables
    const ledger = await ctx.prisma.stockLedger.groupBy({ by: ['warehouseId', 'itemId', 'batchNo', 'stockStatus'], where: { companyId: w.company.id }, _sum: { qty: true, value: true } });
    const balances = await ctx.prisma.stockBalance.findMany({ where: { companyId: w.company.id } });
    expect(balances.length).toBe(ledger.length);
    for (const g of ledger) {
      const bal = balances.find((b) => b.warehouseId === g.warehouseId && b.itemId === g.itemId && b.batchNo === g.batchNo && b.stockStatus === g.stockStatus);
      expect(bal, `${g.itemId}`).toBeDefined();
      expect(bal!.qtyOnHand.toString()).toBe((g._sum.qty ?? 0).toString());
      expect(bal!.value.toString()).toBe((g._sum.value ?? 0).toString());
      expect(bal!.qtyOnHand.gte(0)).toBe(true);
    }
    const valuation = await w.admin.get('/v1/inventory/valuation');
    const ledgerValue = ledger.reduce((sum, g) => sum + Number(g._sum.value ?? 0), 0);
    expect(Number(valuation.body.totalValue)).toBeCloseTo(ledgerValue, 2);
    // the timeline of an item ends at the balance
    const movements = await a.wm.get(`/v1/items/${s.cement.id}/movements`).query({ limit: 100 });
    expect(movements.body.items[0].runningQty).toBe('260');
    expect(movements.body.items.map((m: Json) => m.txnType)).toEqual(expect.arrayContaining(['PURCHASE_RECEIPT', 'PROJECT_ISSUE', 'PROJECT_RETURN', 'TRANSFER_OUT', 'TRANSFER_IN']));
  });

});
