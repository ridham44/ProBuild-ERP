import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { StockLedgerService } from '../src/engines/stock-ledger/stock-ledger.service';
import { startApp, stopApp, TestContext } from './support/app';
import { buildWorld, createItem, createSupplier, expectOk, Json, uniq, userAgent, World } from './support/world';

describe('Items, units, categories and warehouse detail', () => {
  let ctx: TestContext;
  let w: World;
  let foreign: World;

  beforeAll(async () => {
    ctx = await startApp();
    w = await buildWorld(ctx, 'Items');
    foreign = await buildWorld(ctx, 'ItemsX');
  });
  afterAll(() => stopApp(ctx));

  describe('items', () => {
    it('creates an item with tracking flags, stock levels and a preferred supplier', async () => {
      const supplier = await createSupplier(w.admin);
      const category = await expectOk<Json>(await w.admin.post('/v1/item-categories').send({ name: uniq('Cementitious') }));
      const res = await w.admin.post('/v1/items').send({
        sku: uniq('CEM'), name: 'Portland Cement 40kg', baseUnit: 'bag', purchaseUnit: 'pallet', conversionFactor: '56',
        categoryId: category.id, preferredSupplierId: supplier.id, trackBatch: true, trackExpiry: true,
        minStock: '100', maxStock: '2000', reorderPoint: '300', safetyStock: '50', costingMethod: 'WEIGHTED_AVERAGE',
      });
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        baseUnit: 'bag', conversionFactor: '56', trackBatch: true, trackExpiry: true, trackSerial: false,
        minStock: '100', maxStock: '2000', reorderPoint: '300', costingMethod: 'WEIGHTED_AVERAGE', preferredSupplierId: supplier.id,
      });
      const detail = await w.admin.get(`/v1/items/${res.body.id}`);
      expect(detail.body.preferredSupplier).toMatchObject({ id: supplier.id });
      expect(detail.body.category).toMatchObject({ id: category.id });
    });

    it.each(['FIFO', 'MOVING_AVERAGE'])('rejects the unsupported %s costing method with 400', async (method) => {
      const res = await w.admin.post('/v1/items').send({ sku: uniq('BAD'), name: 'Bad', baseUnit: 'pc', costingMethod: method });
      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body.errors)).toContain('costingMethod');
      const sku = uniq('UPD');
      const item = await createItem(w.admin, sku);
      expect((await w.admin.patch(`/v1/items/${item.id}`).send({ costingMethod: method })).status).toBe(400);
    });

    it('accepts standard costing only with a standard cost', async () => {
      expect((await w.admin.post('/v1/items').send({ sku: uniq('STD'), name: 'Std', baseUnit: 'pc', costingMethod: 'STANDARD' })).status).toBe(400);
      const ok = await w.admin.post('/v1/items').send({ sku: uniq('STD'), name: 'Std', baseUnit: 'pc', costingMethod: 'STANDARD', standardCost: '125.5' });
      expect(ok.status).toBe(201);
      expect(ok.body.standardCost).toBe('125.5');
    });

    it('validates stock levels, decimals, duplicates, permissions and authentication', async () => {
      const bad = await w.admin.post('/v1/items').send({ sku: '', name: 'x', baseUnit: 'pc', minStock: '10', maxStock: '5', conversionFactor: '0' });
      expect(bad.status).toBe(400);
      const sku = uniq('DUPSKU');
      await createItem(w.admin, sku);
      expect((await w.admin.post('/v1/items').send({ sku, name: 'Again', baseUnit: 'pc' })).status).toBe(409);
      expect((await ctx.http().get('/v1/items')).status).toBe(401);
      expect((await w.viewer.get('/v1/items')).status).toBe(403);
      expect((await w.buyer.post('/v1/items').send({ sku: uniq('BUY'), name: 'x', baseUnit: 'pc' })).status).toBe(403);
    });

    it('rejects references to another company\'s supplier or category (422) and hides foreign items (404)', async () => {
      const theirSupplier = await createSupplier(foreign.admin);
      const theirCategory = await expectOk<Json>(await foreign.admin.post('/v1/item-categories').send({ name: uniq('Theirs') }));
      const a = await w.admin.post('/v1/items').send({ sku: uniq('X1'), name: 'x', baseUnit: 'pc', preferredSupplierId: theirSupplier.id });
      const b = await w.admin.post('/v1/items').send({ sku: uniq('X2'), name: 'x', baseUnit: 'pc', categoryId: theirCategory.id });
      expect([a.status, b.status]).toEqual([422, 422]);
      const theirItem = await createItem(foreign.admin);
      expect((await w.admin.get(`/v1/items/${theirItem.id}`)).status).toBe(404);
      expect((await w.admin.get(`/v1/items/${theirItem.id}/stock`)).status).toBe(404);
      expect((await w.admin.get(`/v1/items/${theirItem.id}/price-history`)).status).toBe(404);
    });

    it('lists with search, filters, sorting and cursor pagination', async () => {
      const tag = uniq('LI');
      const category = await expectOk<Json>(await w.admin.post('/v1/item-categories').send({ name: tag }));
      for (const n of ['A', 'B', 'C']) await createItem(w.admin, `${tag}-${n}`, { categoryId: category.id, trackBatch: n === 'B' });
      const page1 = await w.admin.get('/v1/items').query({ categoryId: category.id, limit: 2, sort: 'sku:asc' });
      expect(page1.body.items.map((i: Json) => i.sku)).toEqual([`${tag}-A`, `${tag}-B`]);
      const page2 = await w.admin.get('/v1/items').query({ categoryId: category.id, limit: 2, sort: 'sku:asc', cursor: page1.body.nextCursor });
      expect(page2.body.items.map((i: Json) => i.sku)).toEqual([`${tag}-C`]);
      const batch = await w.admin.get('/v1/items').query({ categoryId: category.id, trackBatch: 'true' });
      expect(batch.body.items.map((i: Json) => i.sku)).toEqual([`${tag}-B`]);
      const search = await w.admin.get('/v1/items').query({ search: `${tag}-c` });
      expect(search.body.items).toHaveLength(1);
      expect((await w.admin.get('/v1/items').query({ trackBatch: 'maybe' })).status).toBe(400);
    });

    it('a partial update never resets other fields', async () => {
      const item = await createItem(w.admin, uniq('PART'), { minStock: '5', maxStock: '50', trackBatch: true, brand: 'Acme' });
      const res = await w.admin.patch(`/v1/items/${item.id}`).send({ name: 'Renamed item' });
      expect(res.body).toMatchObject({ name: 'Renamed item', minStock: '5', maxStock: '50', trackBatch: true, brand: 'Acme', costingMethod: 'WEIGHTED_AVERAGE' });
      const inconsistent = await w.admin.patch(`/v1/items/${item.id}`).send({ minStock: '80' });
      expect(inconsistent.status).toBe(422);
    });

    it('locks unit, tracking and costing once stock has moved', async () => {
      const item = await createItem(w.admin, uniq('LOCK'));
      const stock = ctx.app.get(StockLedgerService);
      await ctx.prisma.$transaction((tx) =>
        stock.post(tx, [{ companyId: w.company.id, txnDate: new Date(), txnType: 'OPENING', warehouseId: w.warehouse.id, itemId: item.id, qty: 10, unitCost: 5, sourceType: 'TEST', sourceId: 'lock', userId: 'u' }]),
      );
      const res = await w.admin.patch(`/v1/items/${item.id}`).send({ baseUnit: 'kg' });
      expect(res.status).toBe(422);
      expect((await w.admin.patch(`/v1/items/${item.id}`).send({ name: 'Still editable' })).status).toBe(200);
      expect((await w.admin.delete(`/v1/items/${item.id}`)).status).toBe(422);
    });

    it('maintains unit conversions and refuses a conversion for the base unit', async () => {
      const item = await createItem(w.admin, uniq('UOM'), { baseUnit: 'pc' });
      const set = await w.admin.put(`/v1/items/${item.id}/unit-conversions`).send({ unit: 'box', factor: '12' });
      expect(set.status).toBe(200);
      const update = await w.admin.put(`/v1/items/${item.id}/unit-conversions`).send({ unit: 'box', factor: '10' });
      expect(update.body.factor).toBe('10');
      expect((await w.admin.put(`/v1/items/${item.id}/unit-conversions`).send({ unit: 'pc', factor: '1' })).status).toBe(422);
      expect((await w.admin.put(`/v1/items/${item.id}/unit-conversions`).send({ unit: 'box', factor: '-1' })).status).toBe(400);
      const detail = await w.admin.get(`/v1/items/${item.id}`);
      expect(detail.body.unitConversions).toEqual([expect.objectContaining({ unit: 'box', factor: '10' })]);
      expect((await w.admin.delete(`/v1/items/${item.id}/unit-conversions/box`)).status).toBe(204);
      expect((await w.admin.delete(`/v1/items/${item.id}/unit-conversions/box`)).status).toBe(404);
    });

    it('soft-deletes an unused item and records the timeline', async () => {
      const item = await createItem(w.admin, uniq('DEL'));
      await w.admin.patch(`/v1/items/${item.id}`).send({ description: 'x' });
      const timeline = await w.admin.get(`/v1/items/${item.id}/activity`);
      expect(timeline.body.map((a: { action: string }) => a.action)).toEqual(['CREATE', 'UPDATE']);
      expect((await w.admin.delete(`/v1/items/${item.id}`)).status).toBe(204);
      expect((await w.admin.get(`/v1/items/${item.id}`)).status).toBe(404);
    });
  });

  describe('units of measure and categories', () => {
    it('manages UOM and category master data with duplicate protection', async () => {
      const code = uniq('U').slice(0, 10);
      const created = await w.admin.post('/v1/units-of-measure').send({ code, name: 'Test unit' });
      expect(created.status).toBe(201);
      expect((await w.admin.post('/v1/units-of-measure').send({ code, name: 'Dup' })).status).toBe(409);
      expect((await w.admin.patch(`/v1/units-of-measure/${created.body.id}`).send({ name: 'Renamed unit' })).body.name).toBe('Renamed unit');
      expect((await w.admin.get('/v1/units-of-measure').query({ search: code })).body.items).toHaveLength(1);
      const theirs = await foreign.admin.post('/v1/units-of-measure').send({ code: uniq('F').slice(0, 10), name: 'Theirs' });
      expect((await w.admin.patch(`/v1/units-of-measure/${theirs.body.id}`).send({ name: 'Hijack' })).status).toBe(404);
    });

    it('builds a category tree, refuses cycles and deleting a category that is in use', async () => {
      const parent = await expectOk<Json>(await w.admin.post('/v1/item-categories').send({ name: uniq('Parent') }));
      const child = await expectOk<Json>(await w.admin.post('/v1/item-categories').send({ name: uniq('Child'), parentId: parent.id }));
      expect((await w.admin.patch(`/v1/item-categories/${parent.id}`).send({ parentId: child.id })).status).toBe(422);
      expect((await w.admin.patch(`/v1/item-categories/${parent.id}`).send({ parentId: parent.id })).status).toBe(422);
      await createItem(w.admin, uniq('INCAT'), { categoryId: child.id });
      expect((await w.admin.delete(`/v1/item-categories/${child.id}`)).status).toBe(422);
      expect((await w.admin.delete(`/v1/item-categories/${parent.id}`)).status).toBe(422);
      const empty = await expectOk<Json>(await w.admin.post('/v1/item-categories').send({ name: uniq('Empty') }));
      expect((await w.admin.delete(`/v1/item-categories/${empty.id}`)).status).toBe(204);
    });
  });

  describe('item stock summary', () => {
    it('reports on hand, reserved, committed and available per warehouse from real balances', async () => {
      const item = await createItem(w.admin, uniq('STK'));
      const second = await ctx.prisma.warehouse.create({ data: { companyId: w.company.id, code: uniq('WH2'), name: 'Site warehouse' } });
      const stock = ctx.app.get(StockLedgerService);
      await ctx.prisma.$transaction((tx) =>
        stock.post(tx, [
          { companyId: w.company.id, txnDate: new Date(), txnType: 'PURCHASE_RECEIPT', warehouseId: w.warehouse.id, itemId: item.id, qty: 100, unitCost: 10, sourceType: 'TEST', sourceId: 'a', userId: 'u' },
          { companyId: w.company.id, txnDate: new Date(), txnType: 'PURCHASE_RECEIPT', warehouseId: second.id, itemId: item.id, qty: 40, unitCost: 12, sourceType: 'TEST', sourceId: 'b', userId: 'u' },
          { companyId: w.company.id, txnDate: new Date(), txnType: 'PURCHASE_RECEIPT', warehouseId: w.warehouse.id, itemId: item.id, qty: 7, unitCost: 10, stockStatus: 'QUARANTINE', sourceType: 'TEST', sourceId: 'c', userId: 'u' },
        ]),
      );
      const request = await ctx.prisma.materialRequest.create({
        data: { companyId: w.company.id, number: uniq('MR'), projectId: w.project.id, warehouseId: w.warehouse.id, requestedById: w.users.pm, status: 'APPROVED' },
      });
      await ctx.prisma.materialRequestLine.create({ data: { requestId: request.id, itemId: item.id, qty: 30, approvedQty: 30, issuedQty: 5, unit: 'pc' } });

      const res = await w.admin.get(`/v1/items/${item.id}/stock`);
      expect(res.status).toBe(200);
      expect(res.body.baseUnit).toBe('pc');
      const main = res.body.warehouses.find((r: Json) => r.warehouseId === w.warehouse.id);
      expect(main).toMatchObject({ onHand: '100', reserved: '25', available: '75', committed: '0', quarantine: '7', value: '1000' });
      const site = res.body.warehouses.find((r: Json) => r.warehouseId === second.id);
      expect(site).toMatchObject({ onHand: '40', reserved: '0', available: '40' });
      expect(res.body.totals).toMatchObject({ onHand: '140', reserved: '25', available: '115', committed: '0' });

      const one = await w.admin.get(`/v1/items/${item.id}/stock`).query({ warehouseId: second.id });
      expect(one.body.warehouses).toHaveLength(1);
      expect(one.body.totals.onHand).toBe('40');
    });

    it('limits warehouse-scoped users to their warehouses and denies users without stock permission', async () => {
      const item = await createItem(w.admin, uniq('SCOPE'));
      const other = await ctx.prisma.warehouse.create({ data: { companyId: w.company.id, code: uniq('WH3'), name: 'Other' } });
      const stock = ctx.app.get(StockLedgerService);
      await ctx.prisma.$transaction((tx) =>
        stock.post(tx, [
          { companyId: w.company.id, txnDate: new Date(), txnType: 'OPENING', warehouseId: w.warehouse.id, itemId: item.id, qty: 10, unitCost: 1, sourceType: 'T', sourceId: 'a', userId: 'u' },
          { companyId: w.company.id, txnDate: new Date(), txnType: 'OPENING', warehouseId: other.id, itemId: item.id, qty: 20, unitCost: 1, sourceType: 'T', sourceId: 'b', userId: 'u' },
        ]),
      );
      const scoped = await userAgent(w, ['Warehouse Manager'], { warehouseId: w.warehouse.id });
      const res = await scoped.agent.get(`/v1/items/${item.id}/stock`);
      expect(res.body.warehouses.map((r: Json) => r.warehouseId)).toEqual([w.warehouse.id]);
      expect(res.body.totals.onHand).toBe('10');
      expect((await scoped.agent.get(`/v1/items/${item.id}/stock`).query({ warehouseId: other.id })).status).toBe(403);
      expect((await w.viewer.get(`/v1/items/${item.id}/stock`)).status).toBe(403);
      expect((await ctx.http().get(`/v1/items/${item.id}/stock`)).status).toBe(401);
    });
  });

  describe('warehouse detail', () => {
    it('returns the warehouse, its summary, stock and activity', async () => {
      const wh = await expectOk<Json>(await w.admin.post('/v1/warehouses').send({ code: uniq('WHD'), name: 'Detail WH', type: 'SITE', projectId: w.project.id }));
      const zone = await expectOk<Json>(await w.admin.post('/v1/warehouse-locations').send({ warehouseId: wh.id, level: 'ZONE', code: 'A' }));
      await w.admin.post('/v1/warehouse-locations').send({ warehouseId: wh.id, parentId: zone.id, level: 'RACK', code: 'R01' });
      const item = await createItem(w.admin, uniq('WHI'));
      const stock = ctx.app.get(StockLedgerService);
      await ctx.prisma.$transaction((tx) =>
        stock.post(tx, [{ companyId: w.company.id, txnDate: new Date(), txnType: 'OPENING', warehouseId: wh.id, itemId: item.id, qty: 12, unitCost: 25, sourceType: 'T', sourceId: 'w', userId: 'u' }]),
      );

      const detail = await w.admin.get(`/v1/warehouses/${wh.id}`);
      expect(detail.status).toBe(200);
      expect(detail.body).toMatchObject({ id: wh.id, type: 'SITE', project: { id: w.project.id } });
      const summary = await w.admin.get(`/v1/warehouses/${wh.id}/summary`);
      expect(summary.body.locations.total).toBe(2);
      expect(summary.body.stock.distinctItems).toBe(1);
      expect(summary.body.stock.byStatus).toEqual([{ stockStatus: 'AVAILABLE', qtyOnHand: '12.0000', value: '300.00' }]);
      const rows = await w.admin.get(`/v1/warehouses/${wh.id}/stock`).query({ search: item.sku });
      expect(rows.body.items).toHaveLength(1);
      expect(rows.body.items[0]).toMatchObject({ qtyOnHand: '12', item: { sku: item.sku } });
      const activity = await w.admin.get(`/v1/warehouses/${wh.id}/activity`);
      expect(activity.body[0].action).toBe('CREATE');
    });

    it('enforces tenant isolation, authentication, permissions and warehouse scope', async () => {
      const theirs = await foreign.admin.post('/v1/warehouses').send({ code: uniq('FW'), name: 'Foreign' });
      expect((await w.admin.get(`/v1/warehouses/${theirs.body.id}`)).status).toBe(404);
      expect((await w.admin.get(`/v1/warehouses/${theirs.body.id}/summary`)).status).toBe(404);
      expect((await ctx.http().get(`/v1/warehouses/${w.warehouse.id}`)).status).toBe(401);
      expect((await w.viewer.get(`/v1/warehouses/${w.warehouse.id}`)).status).toBe(403);
      const scoped = await userAgent(w, ['Warehouse Manager'], { warehouseId: w.warehouse.id });
      expect((await scoped.agent.get(`/v1/warehouses/${w.warehouse.id}/summary`)).status).toBe(200);
      const elsewhere = await ctx.prisma.warehouse.create({ data: { companyId: w.company.id, code: uniq('ELSE'), name: 'Elsewhere' } });
      expect((await scoped.agent.get(`/v1/warehouses/${elsewhere.id}`)).status).toBe(403);
      expect((await scoped.agent.get(`/v1/warehouses/${elsewhere.id}/stock`)).status).toBe(403);
    });

    it('a partial warehouse update keeps its type (regression: defaults were applied on PATCH)', async () => {
      const wh = await expectOk<Json>(await w.admin.post('/v1/warehouses').send({ code: uniq('WHP'), name: 'Yard', type: 'YARD' }));
      const res = await w.admin.patch(`/v1/warehouses/${wh.id}`).send({ name: 'Renamed yard' });
      expect(res.body).toMatchObject({ name: 'Renamed yard', type: 'YARD' });
    });
  });
});
