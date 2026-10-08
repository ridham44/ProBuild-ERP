import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startApp, stopApp, TestContext } from './support/app';
import { createWarehouse } from './support/fixtures';
import { stockActors, StockActors, stockOf, stockUp } from './support/stock';
import { Agent, buildWorld, createItem, expectOk, idemKey, Json, setWorkflow, uniq, userAgent, World } from './support/world';

type Doc = Json & { status: string; lines: Json[]; number: string };

describe('Stock queries and stock documents', () => {
  let ctx: TestContext;
  let w: World;
  let rival: World;
  let a: StockActors;
  let wh2: Json;
  let cement: Json;

  const post = (agent: Agent, path: string, body: Record<string, unknown> = {}) => agent.post(path).set('Idempotency-Key', idemKey('d')).send(body);
  const available = async (itemId: unknown, warehouseId: string) => (await stockOf(a.wm, itemId as string, warehouseId)).onHand;

  beforeAll(async () => {
    ctx = await startApp();
    w = await buildWorld(ctx, 'Stk');
    rival = await buildWorld(ctx, 'StkRival');
    a = await stockActors(w);
    wh2 = await createWarehouse(ctx.prisma, w.company, uniq('WH2'));
    cement = await createItem(w.admin, uniq('CEM'), { baseUnit: 'bag', minStock: '500', trackBatch: false });
    await stockUp(w, a, [{ itemId: cement.id, qty: '100', unitPrice: '50' }]);
  });
  afterAll(() => stopApp(ctx));

  describe('balances, movements, valuation', () => {
    it('requires authentication and stock permission', async () => {
      for (const path of ['/v1/inventory/stock-balances', '/v1/inventory/movements', '/v1/inventory/valuation', '/v1/inventory/batches', '/v1/inventory/serials']) {
        expect((await ctx.http().get(path)).status, path).toBe(401);
        expect((await w.finance.get(path)).status, path).toBe(403);
      }
      expect((await ctx.http().get(`/v1/items/${cement.id}/movements`)).status).toBe(401);
    });

    it('lists balances per item and warehouse with on hand, reserved, committed, available and value', async () => {
      const res = await a.wm.get('/v1/inventory/stock-balances').query({ itemId: cement.id });
      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0]).toMatchObject({
        itemId: cement.id, baseUnit: 'bag', warehouseId: w.warehouse.id, onHand: '100', reserved: '0', committed: '0', available: '100',
        quarantine: '0', value: '5000', avgCost: '50', minStock: '500', belowMinimum: true,
      });
      expect(res.body.items[0].sku).toBe(cement.sku);
      const flagged = await a.wm.get('/v1/inventory/stock-balances').query({ belowMinimum: 'true', search: cement.sku });
      expect(flagged.body.items.map((i: Json) => i.itemId)).toContain(cement.id);
    });

    it('shows committed quantity from open purchase orders and splits stock by bin', async () => {
      const item = await createItem(w.admin, uniq('LOC'), { baseUnit: 'pc' });
      const bin = await expectOk<Json>(await w.admin.post('/v1/warehouse-locations').send({ warehouseId: w.warehouse.id, level: 'ZONE', code: uniq('Z') }));
      const { makeApprovedPo, receive } = await import('./support/stock');
      const po = await makeApprovedPo(w, [{ itemId: item.id, qty: '30', unitPrice: '10' }]);
      let row = (await a.wm.get('/v1/inventory/stock-balances').query({ itemId: item.id })).body.items;
      expect(row).toHaveLength(0);
      const committed = await a.wm.get(`/v1/items/${item.id}/stock`);
      expect(committed.body.totals).toMatchObject({ committed: '30', onHand: '0' });
      await receive(a.ws, po.id, [{ orderLineId: po.lines[0]!.id as string, receivedQty: '12', locationId: bin.id }]);
      row = (await a.wm.get('/v1/inventory/stock-balances').query({ itemId: item.id })).body.items;
      expect(row[0]).toMatchObject({ onHand: '12', committed: '18' });
      expect(row[0].locations).toEqual([{ locationId: bin.id, path: bin.fullPath, qty: '12' }]);
    });

    it('filters, sorts and pages with a keyset cursor', async () => {
      const items = [] as Json[];
      for (const name of ['AAA', 'BBB', 'CCC']) {
        const item = await createItem(w.admin, uniq(`PG-${name}`), { baseUnit: 'pc', name: `${name} item` });
        await stockUp(w, a, [{ itemId: item.id, qty: '2', unitPrice: '1' }]);
        items.push(item);
      }
      const first = await a.wm.get('/v1/inventory/stock-balances').query({ limit: 2, sort: 'name:asc', search: 'item' });
      expect(first.body.items).toHaveLength(2);
      expect(first.body.items.map((i: Json) => i.name)).toEqual(['AAA item', 'BBB item']);
      const second = await a.wm.get('/v1/inventory/stock-balances').query({ limit: 2, sort: 'name:asc', search: 'item', cursor: first.body.nextCursor });
      expect(second.body.items[0].name).toBe('CCC item');
      expect((await a.wm.get('/v1/inventory/stock-balances').query({ cursor: 'garbage' })).status).toBe(422);
      expect((await a.wm.get('/v1/inventory/stock-balances').query({ sort: 'value:desc' })).status).toBe(400);
      expect((await a.wm.get('/v1/inventory/stock-balances').query({ limit: 500 })).status).toBe(400);
      const byWh = await a.wm.get('/v1/inventory/stock-balances').query({ warehouseId: wh2.id });
      expect(byWh.body.items).toHaveLength(0);
    });

    it('is scoped to the caller company and warehouses', async () => {
      expect((await rival.admin.get('/v1/inventory/stock-balances')).body.items).toHaveLength(0);
      expect((await rival.admin.get('/v1/inventory/movements').query({ itemId: cement.id })).body.items).toHaveLength(0);
      const scoped = await userAgent(w, ['Warehouse Manager'], { warehouseId: wh2.id });
      expect((await scoped.agent.get('/v1/inventory/stock-balances')).body.items).toHaveLength(0);
      expect((await scoped.agent.get('/v1/inventory/stock-balances').query({ warehouseId: w.warehouse.id })).status).toBe(403);
      expect((await scoped.agent.get('/v1/inventory/movements').query({ warehouseId: w.warehouse.id })).status).toBe(403);
      expect((await scoped.agent.get('/v1/inventory/valuation').query({ warehouseId: w.warehouse.id })).status).toBe(403);
    });

    it('gives an item movement timeline with reference, user and running balance', async () => {
      const res = await a.wm.get(`/v1/items/${cement.id}/movements`);
      expect(res.status).toBe(200);
      const row = res.body.items[0];
      expect(row).toMatchObject({ txnType: 'PURCHASE_RECEIPT', direction: 'IN', qty: '100', unitCost: '50', runningQty: '100', runningValue: '5000', stockStatus: 'AVAILABLE' });
      expect(row.reference).toMatchObject({ type: 'GOODS_RECEIPT' });
      expect(row.reference.number).toMatch(/^GRN-/);
      expect(row.user).toMatchObject({ id: a.wmId });
      expect(row.item.sku).toBe(cement.sku);
      const filtered = await a.wm.get('/v1/inventory/movements').query({ itemId: cement.id, txnType: 'PROJECT_ISSUE' });
      expect(filtered.body.items).toHaveLength(0);
      expect((await a.wm.get('/v1/inventory/movements').query({ sort: 'bogus:asc' })).status).toBe(400);
      expect((await a.wm.get('/v1/inventory/movements').query({ limit: 1 })).body.nextCursor).toBeTruthy();
    });

    it('summarises valuation by warehouse, category and item', async () => {
      const byWh = await a.wm.get('/v1/inventory/valuation').query({ warehouseId: w.warehouse.id });
      expect(byWh.status).toBe(200);
      expect(byWh.body).toMatchObject({ groupBy: 'warehouse' });
      expect(byWh.body.rows[0]).toMatchObject({ key: w.warehouse.id });
      const sum = await ctx.prisma.stockBalance.aggregate({ where: { companyId: w.company.id, warehouseId: w.warehouse.id }, _sum: { value: true } });
      expect(byWh.body.totalValue).toBe(sum._sum.value?.toString());
      const byItem = await a.wm.get('/v1/inventory/valuation').query({ groupBy: 'item' });
      expect(byItem.body.rows.find((r: Json) => r.key === cement.id)).toMatchObject({ qty: '100', value: '5000', code: cement.sku });
      expect((await a.wm.get('/v1/inventory/valuation').query({ groupBy: 'category' })).body.rows.length).toBeGreaterThan(0);
      expect((await a.wm.get('/v1/inventory/valuation').query({ groupBy: 'fifo' })).status).toBe(400);
    });
  });

  describe('warehouse transfer', () => {
    it('validates and enforces access', async () => {
      const body = { fromWarehouseId: w.warehouse.id, toWarehouseId: wh2.id, lines: [{ itemId: cement.id, qty: '1' }] };
      expect((await ctx.http().post('/v1/warehouse-transfers').send(body)).status).toBe(401);
      expect((await w.viewer.post('/v1/warehouse-transfers').send(body)).status).toBe(403);
      expect((await a.ws.post('/v1/warehouse-transfers').send({ ...body, toWarehouseId: w.warehouse.id })).status).toBe(400);
      expect((await a.ws.post('/v1/warehouse-transfers').send({ ...body, lines: [] })).status).toBe(400);
      expect((await a.ws.post('/v1/warehouse-transfers').send({ ...body, lines: [{ itemId: cement.id, qty: '1', unit: 'drum' }] })).status).toBe(422);
      expect((await a.ws.post('/v1/warehouse-transfers').send({ ...body, toWarehouseId: '00000000-0000-4000-8000-000000000000' })).status).toBe(422);
      expect((await rival.admin.post('/v1/warehouse-transfers').send(body)).status).toBe(422);
      const scoped = await userAgent(w, ['Warehouse Staff'], { warehouseId: wh2.id });
      expect((await scoped.agent.post('/v1/warehouse-transfers').send(body)).status).toBe(403);
    });

    it('moves stock between warehouses at the source cost and records both legs', async () => {
      const draft = await expectOk<Doc>(await a.ws.post('/v1/warehouse-transfers').send({ fromWarehouseId: w.warehouse.id, toWarehouseId: wh2.id, remarks: 'Site restock', lines: [{ itemId: cement.id, qty: '30' }] }), 201);
      expect(draft).toMatchObject({ status: 'DRAFT' });
      expect(draft.number).toMatch(/^WT-/);
      // no workflow: a draft can be posted straight away
      const key = idemKey('wt');
      const posted = await a.ws.post(`/v1/warehouse-transfers/${draft.id}/post`).set('Idempotency-Key', key).send({});
      expect(posted.status).toBe(200);
      expect(posted.body.status).toBe('POSTED');
      expect(await available(cement.id, w.warehouse.id)).toBe('70');
      expect(await available(cement.id, wh2.id as string)).toBe('30');
      const rows = await ctx.prisma.stockLedger.findMany({ where: { companyId: w.company.id, sourceType: 'WAREHOUSE_TRANSFER', sourceId: draft.id } });
      expect(rows.map((r) => [r.txnType, r.qty.toString(), r.unitCost.toString()]).sort()).toEqual([['TRANSFER_IN', '30', '50'], ['TRANSFER_OUT', '-30', '50']]);
      expect((await a.ws.post(`/v1/warehouse-transfers/${draft.id}/post`).set('Idempotency-Key', key).send({})).headers['idempotent-replayed']).toBe('true');
      expect((await post(a.ws, `/v1/warehouse-transfers/${draft.id}/post`)).status).toBe(422);
      expect((await a.wm.post(`/v1/warehouse-transfers/${draft.id}/cancel`).send({ reason: 'Posted already' })).status).toBe(422);
      expect((await a.ws.patch(`/v1/warehouse-transfers/${draft.id}`).send({ remarks: 'x' })).status).toBe(422);
      const trail = await a.wm.get(`/v1/warehouse-transfers/${draft.id}/activity`);
      expect(trail.body.map((t: { action: string }) => t.action)).toEqual(['CREATE', 'POST']);
      expect((await rival.admin.get(`/v1/warehouse-transfers/${draft.id}`)).status).toBe(404);
      expect((await a.wm.get('/v1/warehouse-transfers').query({ status: 'POSTED', warehouseId: wh2.id })).body.items).toHaveLength(1);
      // move it back so later tests start from 100 / 0
      const back = await expectOk<Doc>(await a.ws.post('/v1/warehouse-transfers').send({ fromWarehouseId: wh2.id, toWarehouseId: w.warehouse.id, lines: [{ itemId: cement.id, qty: '30' }] }), 201);
      expect((await post(a.ws, `/v1/warehouse-transfers/${back.id}/post`)).status).toBe(200);
      expect(await available(cement.id, w.warehouse.id)).toBe('100');
    });

    it('cannot move more than is available or stock reserved for approved requests', async () => {
      const item = await createItem(w.admin, uniq('TRF'), { baseUnit: 'pc' });
      await stockUp(w, a, [{ itemId: item.id, qty: '100', unitPrice: '10' }]);
      const over = await expectOk<Doc>(await a.ws.post('/v1/warehouse-transfers').send({ fromWarehouseId: w.warehouse.id, toWarehouseId: wh2.id, lines: [{ itemId: item.id, qty: '101' }] }), 201);
      expect((await post(a.ws, `/v1/warehouse-transfers/${over.id}/post`)).body.detail).toMatch(/Cannot transfer 101/);
      // an approved request reserves 70
      const mr = await expectOk<Json & { lines: Json[] }>(await w.engineer.post('/v1/material-requests').send({ projectId: w.project.id, warehouseId: w.warehouse.id, lines: [{ itemId: item.id, qty: '70' }] }), 201);
      await w.engineer.post(`/v1/material-requests/${mr.id}/submit`).set('Idempotency-Key', idemKey()).send({});
      const reserved = await a.ws.post('/v1/warehouse-transfers').send({ fromWarehouseId: w.warehouse.id, toWarehouseId: wh2.id, lines: [{ itemId: item.id, qty: '40' }] });
      const res = await post(a.ws, `/v1/warehouse-transfers/${reserved.body.id}/post`);
      expect(res.status).toBe(422);
      expect(res.body.detail).toMatch(/only 30 is free/);
    });

    it('keeps batch and serial identity', async () => {
      const batchItem = await createItem(w.admin, uniq('TB'), { baseUnit: 'kg', trackBatch: true, trackExpiry: true });
      const serialItem = await createItem(w.admin, uniq('TS'), { baseUnit: 'pc', trackSerial: true, itemType: 'SERIALIZED' });
      await stockUp(w, a, [
        { itemId: batchItem.id, qty: '20', unitPrice: '8', batchNo: 'B-77', expiryDate: '2027-05-31' },
        { itemId: serialItem.id, qty: '2', unitPrice: '900', serialNos: ['TS-1', 'TS-2'] },
      ]);
      const missing = await a.ws.post('/v1/warehouse-transfers').send({ fromWarehouseId: w.warehouse.id, toWarehouseId: wh2.id, lines: [{ itemId: batchItem.id, qty: '5' }] });
      expect(missing.status).toBe(422);
      const doc = await expectOk<Doc>(
        await a.ws.post('/v1/warehouse-transfers').send({
          fromWarehouseId: w.warehouse.id, toWarehouseId: wh2.id,
          lines: [{ itemId: batchItem.id, qty: '5', batchNo: 'B-77' }, { itemId: serialItem.id, qty: '1', serialNo: 'TS-2' }],
        }),
        201,
      );
      expect((await post(a.ws, `/v1/warehouse-transfers/${doc.id}/post`)).status).toBe(200);
      const buckets = await ctx.prisma.stockBalance.findMany({ where: { companyId: w.company.id, itemId: batchItem.id as string }, orderBy: { warehouseId: 'asc' } });
      expect(buckets.map((b) => [b.batchNo, b.qtyOnHand.toString(), b.avgCost.toString()]).sort()).toEqual([['B-77', '15', '8'], ['B-77', '5', '8']]);
      const unit = await ctx.prisma.serialUnit.findFirstOrThrow({ where: { companyId: w.company.id, itemId: serialItem.id as string, serialNo: 'TS-2' } });
      expect(unit.warehouseId).toBe(wh2.id);
      const unmoved = await ctx.prisma.serialUnit.findFirstOrThrow({ where: { companyId: w.company.id, itemId: serialItem.id as string, serialNo: 'TS-1' } });
      expect(unmoved.warehouseId).toBe(w.warehouse.id);
    });

    it('only one of two simultaneous transfers of the same stock succeeds', async () => {
      const item = await createItem(w.admin, uniq('TRC'), { baseUnit: 'pc' });
      await stockUp(w, a, [{ itemId: item.id, qty: '100', unitPrice: '10' }]);
      const make = async () => expectOk<Doc>(await a.ws.post('/v1/warehouse-transfers').send({ fromWarehouseId: w.warehouse.id, toWarehouseId: wh2.id, lines: [{ itemId: item.id, qty: '60' }] }), 201);
      const [t1, t2] = [await make(), await make()];
      const results = await Promise.all([post(a.ws, `/v1/warehouse-transfers/${t1.id}/post`), post(a.ws, `/v1/warehouse-transfers/${t2.id}/post`)]);
      expect(results.map((r) => r.status).sort()).toEqual([200, 422]);
      expect(await available(item.id, w.warehouse.id)).toBe('40');
      expect(await available(item.id, wh2.id as string)).toBe('60');
    });

    it('runs through the optional WAREHOUSE_TRANSFER approval workflow', async () => {
      const w2 = await buildWorld(ctx, 'StkAprT');
      const b = await stockActors(w2);
      const dest = await createWarehouse(ctx.prisma, w2.company, uniq('D'));
      const item = await createItem(w2.admin, uniq('WF'), { baseUnit: 'pc' });
      await stockUp(w2, b, [{ itemId: item.id, qty: '50', unitPrice: '10' }]);
      await setWorkflow(w2.admin, 'WAREHOUSE_TRANSFER', [{ minAmount: '0', steps: ['Warehouse Manager'] }]);
      const doc = await expectOk<Doc>(await b.ws.post('/v1/warehouse-transfers').send({ fromWarehouseId: w2.warehouse.id, toWarehouseId: dest.id, lines: [{ itemId: item.id, qty: '10' }] }), 201);
      const direct = await post(b.ws, `/v1/warehouse-transfers/${doc.id}/post`);
      expect(direct.status).toBe(422);
      expect(direct.body.detail).toMatch(/needs approval/);
      const submitted = await post(b.ws, `/v1/warehouse-transfers/${doc.id}/submit`);
      expect(submitted.body).toMatchObject({ status: 'SUBMITTED' });
      expect(submitted.body.approvals[0]).toMatchObject({ currentRole: 'Warehouse Manager' });
      expect((await post(b.ws, `/v1/warehouse-transfers/${doc.id}/approve`)).status).toBe(403);
      expect((await post(b.ws, `/v1/warehouse-transfers/${doc.id}/post`)).status).toBe(422);
      const approved = await post(b.wm, `/v1/warehouse-transfers/${doc.id}/approve`, { comment: 'Go ahead' });
      expect(approved.body.status).toBe('APPROVED');
      expect((await post(b.ws, `/v1/warehouse-transfers/${doc.id}/post`)).status).toBe(200);
      // rejection path
      const other = await expectOk<Doc>(await b.ws.post('/v1/warehouse-transfers').send({ fromWarehouseId: w2.warehouse.id, toWarehouseId: dest.id, lines: [{ itemId: item.id, qty: '5' }] }), 201);
      await post(b.ws, `/v1/warehouse-transfers/${other.id}/submit`);
      expect((await post(b.wm, `/v1/warehouse-transfers/${other.id}/reject`)).status).toBe(400);
      expect((await post(b.wm, `/v1/warehouse-transfers/${other.id}/reject`, { comment: 'Not needed' })).body.status).toBe('REJECTED');
      expect((await post(b.ws, `/v1/warehouse-transfers/${other.id}/post`)).status).toBe(422);
      const trail = await b.wm.get(`/v1/warehouse-transfers/${doc.id}/activity`);
      expect(trail.body.map((t: { action: string }) => t.action)).toEqual(expect.arrayContaining(['CREATE', 'SUBMIT', 'APPROVED', 'POST']));
    });
  });

  describe('stock adjustment', () => {
    it('requires a reason and valid lines', async () => {
      const line = { itemId: cement.id, qtyDelta: '-1' };
      expect((await ctx.http().post('/v1/stock-adjustments').send({})).status).toBe(401);
      expect((await a.ws.post('/v1/stock-adjustments').send({ warehouseId: w.warehouse.id, reason: 'Recount found a shortage', lines: [line] })).status).toBe(403);
      expect((await a.wm.post('/v1/stock-adjustments').send({ warehouseId: w.warehouse.id, reason: 'no', lines: [line] })).status).toBe(400);
      expect((await a.wm.post('/v1/stock-adjustments').send({ warehouseId: w.warehouse.id, reason: 'Recount found a shortage', lines: [{ ...line, qtyDelta: '0' }] })).status).toBe(400);
      expect((await a.wm.post('/v1/stock-adjustments').send({ warehouseId: w.warehouse.id, reason: 'Recount found a shortage', lines: [{ ...line, unitCost: '5' }] })).status).toBe(422);
      const serial = await createItem(w.admin, uniq('AS'), { baseUnit: 'pc', trackSerial: true, itemType: 'SERIALIZED' });
      expect((await a.wm.post('/v1/stock-adjustments').send({ warehouseId: w.warehouse.id, reason: 'Recount found a shortage', lines: [{ itemId: serial.id, qtyDelta: '1', unitCost: '1' }] })).status).toBe(422);
      expect((await rival.admin.post('/v1/stock-adjustments').send({ warehouseId: w.warehouse.id, reason: 'Recount found a shortage', lines: [line] })).status).toBe(422);
    });

    it('posts gains at the stated or average cost and losses at average cost', async () => {
      const item = await createItem(w.admin, uniq('ADJ'), { baseUnit: 'pc' });
      await stockUp(w, a, [{ itemId: item.id, qty: '10', unitPrice: '20' }]);
      const doc = await expectOk<Doc>(
        await a.wm.post('/v1/stock-adjustments').send({ warehouseId: w.warehouse.id, reason: 'Found stock in the old container', lines: [{ itemId: item.id, qtyDelta: '5' }] }),
        201,
      );
      expect(doc.number).toMatch(/^SA-/);
      expect((await post(a.wm, `/v1/stock-adjustments/${doc.id}/post`)).body.status).toBe('POSTED');
      expect(await stockOf(a.wm, item.id)).toMatchObject({ onHand: '15', value: '300' });
      const loss = await expectOk<Doc>(await a.wm.post('/v1/stock-adjustments').send({ warehouseId: w.warehouse.id, reason: 'Damaged during a typhoon', lines: [{ itemId: item.id, qtyDelta: '-3' }] }), 201);
      const posted = await post(a.wm, `/v1/stock-adjustments/${loss.id}/post`);
      expect(posted.body.lines[0]).toMatchObject({ unitCost: '20', value: '-60' });
      expect(await stockOf(a.wm, item.id)).toMatchObject({ onHand: '12', value: '240' });
      const gainCost = await expectOk<Doc>(await a.wm.post('/v1/stock-adjustments').send({ warehouseId: w.warehouse.id, reason: 'Supplier credit in kind', lines: [{ itemId: item.id, qtyDelta: '8', unitCost: '30' }] }), 201);
      await post(a.wm, `/v1/stock-adjustments/${gainCost.id}/post`);
      expect(await stockOf(a.wm, item.id)).toMatchObject({ onHand: '20', value: '480' });
      const types = await ctx.prisma.stockLedger.findMany({ where: { companyId: w.company.id, sourceType: 'STOCK_ADJUSTMENT', itemId: item.id as string } });
      expect(types.map((t) => t.txnType).sort()).toEqual(['ADJUSTMENT_GAIN', 'ADJUSTMENT_GAIN', 'ADJUSTMENT_LOSS']);
      // more than is on hand
      const big = await expectOk<Doc>(await a.wm.post('/v1/stock-adjustments').send({ warehouseId: w.warehouse.id, reason: 'Wrote off too much', lines: [{ itemId: item.id, qtyDelta: '-500' }] }), 201);
      const refused = await post(a.wm, `/v1/stock-adjustments/${big.id}/post`);
      expect(refused.status).toBe(422);
      expect(refused.body.detail).toMatch(/Insufficient stock/);
      expect((await post(a.wm, `/v1/stock-adjustments/${loss.id}/post`)).status).toBe(422);
      expect((await a.wm.post(`/v1/stock-adjustments/${big.id}/cancel`).send({ reason: 'Wrong quantity typed' })).body.status).toBe('CANCELLED');
      expect((await a.wm.post(`/v1/stock-adjustments/${loss.id}/cancel`).send({ reason: 'Posted already' })).status).toBe(422);
      expect((await rival.admin.get(`/v1/stock-adjustments/${doc.id}`)).status).toBe(404);
    });

    it('needs approval through the STOCK_ADJUSTMENT workflow before posting', async () => {
      const w2 = await buildWorld(ctx, 'StkAprA');
      const b = await stockActors(w2);
      const b2 = await userAgent(w2, ['Warehouse Manager']);
      const item = await createItem(w2.admin, uniq('AP'), { baseUnit: 'pc' });
      await stockUp(w2, b, [{ itemId: item.id, qty: '100', unitPrice: '100' }]);
      await setWorkflow(w2.admin, 'STOCK_ADJUSTMENT', [{ minAmount: '0', steps: ['Warehouse Manager'] }]);
      const doc = await expectOk<Doc>(await b.wm.post('/v1/stock-adjustments').send({ warehouseId: w2.warehouse.id, reason: 'Count shortage from last month', lines: [{ itemId: item.id, qtyDelta: '-10' }] }), 201);
      const direct = await post(b.wm, `/v1/stock-adjustments/${doc.id}/post`);
      expect(direct.status).toBe(422);
      expect(direct.body.detail).toMatch(/needs approval/);
      const submitted = await post(b.wm, `/v1/stock-adjustments/${doc.id}/submit`);
      expect(submitted.body.status).toBe('SUBMITTED');
      expect((await post(b.wm, `/v1/stock-adjustments/${doc.id}/approve`)).status).toBe(403);
      expect((await post(b.ws, `/v1/stock-adjustments/${doc.id}/approve`)).status).toBe(403);
      expect((await post(b.wm, `/v1/stock-adjustments/${doc.id}/post`)).status).toBe(422);
      expect((await post(b2.agent, `/v1/stock-adjustments/${doc.id}/approve`, { comment: 'Verified against the count sheet' })).body.status).toBe('APPROVED');
      expect((await post(b2.agent, `/v1/stock-adjustments/${doc.id}/approve`)).status).toBe(422);
      expect((await post(b.wm, `/v1/stock-adjustments/${doc.id}/post`)).status).toBe(200);
      expect(await stockOf(b.wm, item.id)).toMatchObject({ onHand: '90', value: '9000' });
      const trail = await b.wm.get(`/v1/stock-adjustments/${doc.id}/activity`);
      expect(trail.body.map((t: { action: string }) => t.action)).toEqual(expect.arrayContaining(['CREATE', 'SUBMIT', 'APPROVED', 'POST']));
      const rejected = await expectOk<Doc>(await b.wm.post('/v1/stock-adjustments').send({ warehouseId: w2.warehouse.id, reason: 'Another unexplained shortage', lines: [{ itemId: item.id, qtyDelta: '-1' }] }), 201);
      await post(b.wm, `/v1/stock-adjustments/${rejected.id}/submit`);
      expect((await post(b2.agent, `/v1/stock-adjustments/${rejected.id}/reject`, { comment: 'Investigate first' })).body.status).toBe('REJECTED');
      expect((await post(b.wm, `/v1/stock-adjustments/${rejected.id}/post`)).status).toBe(422);
    });
  });

  describe('stock count', () => {
    it('snapshots system quantities, records physical counts and posts approved variances', async () => {
      const w2 = await buildWorld(ctx, 'StkCnt');
      const b = await stockActors(w2);
      const item = await createItem(w2.admin, uniq('CNT'), { baseUnit: 'pc' });
      const item2 = await createItem(w2.admin, uniq('CN2'), { baseUnit: 'pc' });
      expect((await b.ws.post('/v1/stock-counts').send({ warehouseId: w2.warehouse.id })).status).toBe(422);
      await stockUp(w2, b, [{ itemId: item.id, qty: '50', unitPrice: '10' }, { itemId: item2.id, qty: '20', unitPrice: '5' }]);
      expect((await ctx.http().post('/v1/stock-counts').send({})).status).toBe(401);
      expect((await w2.viewer.post('/v1/stock-counts').send({ warehouseId: w2.warehouse.id })).status).toBe(403);
      expect((await b.ws.post('/v1/stock-counts').send({ warehouseId: 'x' })).status).toBe(400);

      const count = await expectOk<Doc & { summary: Json }>(await b.ws.post('/v1/stock-counts').send({ warehouseId: w2.warehouse.id, remarks: 'Monthly cycle count' }), 201);
      expect(count.number).toMatch(/^SC-/);
      expect(count.lines).toHaveLength(2);
      expect(count.lines.map((l) => l.systemQty).sort()).toEqual(['20', '50']);
      expect((await post(b.ws, `/v1/stock-counts/${count.id}/submit`)).body.detail).toMatch(/2 line\(s\) have not been counted/);
      const l1 = count.lines.find((l) => l.systemQty === '50')!;
      const l2 = count.lines.find((l) => l.systemQty === '20')!;
      const recorded = await b.ws.put(`/v1/stock-counts/${count.id}/lines`).send({ lines: [{ lineId: l1.id, physicalQty: '47', reason: '3 bags torn' }, { lineId: l2.id, physicalQty: '22' }] });
      expect(recorded.status).toBe(200);
      expect(recorded.body.lines.find((l: Json) => l.id === l1.id)).toMatchObject({ varianceQty: '-3', varianceValue: '-30', counted: true });
      expect(recorded.body.summary).toMatchObject({ counted: 2, gainValue: '10', lossValue: '-30', varianceValue: '-20' });
      expect((await post(b.ws, `/v1/stock-counts/${count.id}/submit`)).body.detail).toMatch(/need a reason/);
      expect((await b.ws.put(`/v1/stock-counts/${count.id}/lines`).send({ lines: [{ lineId: '00000000-0000-4000-8000-000000000000', physicalQty: '1' }] })).status).toBe(422);
      await b.ws.put(`/v1/stock-counts/${count.id}/lines`).send({ lines: [{ lineId: l2.id, physicalQty: '22', reason: 'Found a carton' }] });

      expect((await post(b.ws, `/v1/stock-counts/${count.id}/post`)).status).toBe(422);
      const submitted = await post(b.ws, `/v1/stock-counts/${count.id}/submit`);
      expect(submitted.body.status).toBe('APPROVED');
      expect((await b.ws.put(`/v1/stock-counts/${count.id}/lines`).send({ lines: [{ lineId: l1.id, physicalQty: '1' }] })).status).toBe(422);
      const posted = await post(b.ws, `/v1/stock-counts/${count.id}/post`);
      expect(posted.body.status).toBe('POSTED');
      expect(await stockOf(b.wm, item.id)).toMatchObject({ onHand: '47', value: '470' });
      expect(await stockOf(b.wm, item2.id)).toMatchObject({ onHand: '22', value: '110' });
      const rows = await ctx.prisma.stockLedger.findMany({ where: { companyId: w2.company.id, sourceType: 'STOCK_COUNT', sourceId: count.id } });
      expect(rows.map((r) => r.txnType)).toEqual(['COUNT_VARIANCE', 'COUNT_VARIANCE']);
      expect((await post(b.ws, `/v1/stock-counts/${count.id}/post`)).status).toBe(422);
      expect((await rival.admin.get(`/v1/stock-counts/${count.id}`)).status).toBe(404);
    });

    it('goes through the STOCK_COUNT approval workflow', async () => {
      const w2 = await buildWorld(ctx, 'StkCntA');
      const b = await stockActors(w2);
      const item = await createItem(w2.admin, uniq('CA'), { baseUnit: 'pc' });
      await stockUp(w2, b, [{ itemId: item.id, qty: '10', unitPrice: '10' }]);
      await setWorkflow(w2.admin, 'STOCK_COUNT', [{ minAmount: '0', steps: ['Warehouse Manager'] }]);
      const count = await expectOk<Doc>(await b.ws.post('/v1/stock-counts').send({ warehouseId: w2.warehouse.id, itemIds: [item.id] }), 201);
      await b.ws.put(`/v1/stock-counts/${count.id}/lines`).send({ lines: [{ lineId: count.lines[0]!.id, physicalQty: '8', reason: 'Shrinkage' }] });
      expect((await post(b.ws, `/v1/stock-counts/${count.id}/submit`)).body.status).toBe('SUBMITTED');
      expect((await post(b.ws, `/v1/stock-counts/${count.id}/approve`)).status).toBe(403);
      expect((await post(b.ws, `/v1/stock-counts/${count.id}/post`)).status).toBe(422);
      expect((await post(b.wm, `/v1/stock-counts/${count.id}/approve`)).body.status).toBe('APPROVED');
      expect((await post(b.ws, `/v1/stock-counts/${count.id}/post`)).status).toBe(200);
      expect(await stockOf(b.wm, item.id)).toMatchObject({ onHand: '8' });
      const second = await expectOk<Doc>(await b.ws.post('/v1/stock-counts').send({ warehouseId: w2.warehouse.id }), 201);
      expect((await b.wm.post(`/v1/stock-counts/${second.id}/cancel`).send({ reason: 'Started by mistake' })).body.status).toBe('CANCELLED');
    });
  });

  describe('reconciliation', () => {
    it('is administrator-only and clean when balances equal the ledger', async () => {
      expect((await ctx.http().get('/v1/inventory/reconciliation')).status).toBe(401);
      expect((await a.wm.get('/v1/inventory/reconciliation')).status).toBe(403);
      expect((await w.viewer.get('/v1/inventory/reconciliation')).status).toBe(403);
      const res = await w.admin.get('/v1/inventory/reconciliation');
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ clean: true, differences: [] });
      expect(res.body.bucketsChecked).toBeGreaterThan(5);
      expect((await rival.admin.get('/v1/inventory/reconciliation')).body).toMatchObject({ clean: true, bucketsChecked: 0 });
    });

    it('reports any bucket whose balance differs from its ledger sum', async () => {
      const bucket = await ctx.prisma.stockBalance.findFirstOrThrow({ where: { companyId: w.company.id, itemId: cement.id as string, warehouseId: w.warehouse.id } });
      await ctx.prisma.stockBalance.update({ where: { id: bucket.id }, data: { qtyOnHand: bucket.qtyOnHand.plus(7) } });
      try {
        const res = await w.admin.get('/v1/inventory/reconciliation').query({ itemId: cement.id });
        expect(res.body.clean).toBe(false);
        expect(res.body.differences[0]).toMatchObject({ itemId: cement.id, warehouseId: w.warehouse.id, qtyDifference: '7', valueDifference: '0', negativeStock: false });
      } finally {
        await ctx.prisma.stockBalance.update({ where: { id: bucket.id }, data: { qtyOnHand: bucket.qtyOnHand } });
      }
      expect((await w.admin.get('/v1/inventory/reconciliation').query({ itemId: cement.id })).body.clean).toBe(true);
    });
  });
});
