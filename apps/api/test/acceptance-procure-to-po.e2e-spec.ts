import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startApp, stopApp, TestContext } from './support/app';
import { buildWorld, expectOk, idemKey, Json, setWorkflow, uniq, World } from './support/world';

type State = {
  lines: Json[];
  branch: Json; customer: Json; holcim: Json; republic: Json; mactan: Json; cementCat: Json; cement: Json; rebar: Json;
  warehouse: Json; bin: Json; costCode: Json; project: Json; wbsRoot: Json; wbs: Json; estimate: Json; boqConcrete: Json; boqRebar: Json;
  pr: Json; rfq: Json; steelRfq: Json; qHolcim: Json; qRepublic: Json; qMactan: Json; qSteel: Json; po: Json; poSteel: Json;
};

/**
 * Acceptance flow, first half: Philippine contractor master data -> project/WBS/cost code/BOQ -> PR ->
 * approval -> RFQ -> quotations -> comparison -> award -> PO -> approval -> sent.
 *
 * The scenario state lives in `s` so the inventory stages can continue in this same file:
 *   GRN against `s.po` (partial + remaining) -> QC -> stock -> material request -> issue -> project cost.
 * Add new `it` blocks at the marked extension point; every id they need is already in `s`.
 */
describe('Acceptance: setup to approved purchase order', () => {
  let ctx: TestContext;
  let w: World;
  let rival: World;

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
    expect(prices.body.items.map((p: Json) => [p.source, p.supplier.id === s.holcim.id || p.supplier.id === s.republic.id])).toEqual(
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

  // EXTENSION POINT (inventory stages): continue here with GRN against s.po / s.poSteel (ordered 1200 bags and
  // 400 bars, committed on both), QC, stock, material request, material issue and project cost. s.lines holds the
  // requisition lines, s.warehouse/s.bin the receiving location, s.wbs/s.costCode/s.boqConcrete/s.boqRebar the
  // cost dimensions and w.* the role agents (buyer, finance, pm, engineer, admin).
});
