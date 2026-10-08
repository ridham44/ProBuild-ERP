import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startApp, stopApp, TestContext } from './support/app';
import { createWarehouse } from './support/fixtures';
import { createGrn, makeApprovedPo, postGrn, receive, StockActors, stockActors, stockOf } from './support/stock';
import { buildWorld, createItem, expectOk, idemKey, Json, uniq, userAgent, World } from './support/world';

type Detail = Json & { status: string; lines: Array<Json & { id: string; orderLineId: string }> };

describe('Goods receipt + QC', () => {
  let ctx: TestContext;
  let w: World;
  let rival: World;
  let a: StockActors;
  let cement: Json;

  const poLine = async (po: Json) => (await w.buyer.get(`/v1/purchase-orders/${po.id}`)).body as Json & { status: string; lines: Array<Json & { receivedQty: string; openQty: string }> };

  beforeAll(async () => {
    ctx = await startApp();
    w = await buildWorld(ctx, 'Rcv');
    rival = await buildWorld(ctx, 'RcvRival');
    a = await stockActors(w);
    cement = await createItem(w.admin, uniq('CEM'), { baseUnit: 'bag' });
  });
  afterAll(() => stopApp(ctx));

  describe('draft, posting and PO quantities', () => {
    let po: Json & { lines: Json[] };
    let grn1: Detail;

    it('shows ordered / previously received / remaining for a purchase order', async () => {
      po = await makeApprovedPo(w, [{ itemId: cement.id, qty: '100', unitPrice: '50' }], { freight: '100' });
      const res = await a.wm.get(`/v1/purchase-orders/${po.id}/receivable-lines`);
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ receivable: true, overReceiptTolerancePct: '10' });
      expect(res.body.lines[0]).toMatchObject({ ordered: '100', previouslyReceived: '0', remaining: '100' });
    });

    it('creates a draft that shows Ordered / Previously received / Remaining / Receiving now', async () => {
      grn1 = (await createGrn(a.ws, po.id, [{ orderLineId: po.lines[0]!.id as string, receivedQty: '40' }], { vehicle: 'ABC 123', driver: 'Juan' })) as Detail;
      expect(grn1).toMatchObject({ status: 'DRAFT', vehicle: 'ABC 123', driver: 'Juan' });
      expect(grn1.number).toMatch(/^GRN-/);
      expect(grn1.lines[0]).toMatchObject({ ordered: '100', previouslyReceived: '0', remaining: '100', receivingNow: '40', overReceiving: false });
      expect(await ctx.prisma.stockLedger.count({ where: { companyId: w.company.id, itemId: cement.id } })).toBe(0);
    });

    it('posts: stock at landed cost, PO quantity and status, last purchase cost, audit', async () => {
      const key = idemKey('post1');
      const res = await a.ws.post(`/v1/goods-receipts/${grn1.id}/post`).set('Idempotency-Key', key).send({});
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ status: 'POSTED' });
      expect(res.body.lines[0]).toMatchObject({ acceptedQty: '40', rejectedQty: '0', quarantineQty: '0', qcResult: 'ACCEPTED' });
      // (100 x 50 net + 100 freight) / 100 = 51 per bag
      expect(res.body.lines[0].unitCost).toBe('51');
      const balances = await a.wm.get('/v1/inventory/stock-balances').query({ itemId: cement.id });
      expect(balances.body.items[0]).toMatchObject({ onHand: '40', value: '2040', avgCost: '51', warehouseId: w.warehouse.id });
      const item = await w.admin.get(`/v1/items/${cement.id}`);
      expect(item.body.lastPurchaseCost).toBe('51');
      const order = await poLine(po);
      expect(order.status).toBe('PARTIALLY_RECEIVED');
      expect(order.lines[0]).toMatchObject({ receivedQty: '40', openQty: '60' });
      const replay = await a.ws.post(`/v1/goods-receipts/${grn1.id}/post`).set('Idempotency-Key', key).send({});
      expect(replay.headers['idempotent-replayed']).toBe('true');
      expect(await ctx.prisma.stockLedger.count({ where: { companyId: w.company.id, itemId: cement.id, txnType: 'PURCHASE_RECEIPT' } })).toBe(1);
    });

    it('refuses a second post of the same receipt even with a new key (double post)', async () => {
      const again = await a.ws.post(`/v1/goods-receipts/${grn1.id}/post`).set('Idempotency-Key', idemKey('post-again')).send({});
      expect(again.status).toBe(422);
      expect(again.body.detail).toMatch(/POSTED receipt cannot be posted/);
      expect((await a.ws.patch(`/v1/goods-receipts/${grn1.id}`).send({ remarks: 'late edit' })).status).toBe(422);
    });

    it('QC: partial inspection sends goods to AVAILABLE, QUARANTINE or back to the supplier', async () => {
      const grn = (await createGrn(a.ws, po.id, [{ orderLineId: po.lines[0]!.id as string, receivedQty: '60' }])) as Detail;
      // QC is a separate authority: warehouse staff may not record it
      const lineId = grn.lines[0]!.id;
      const body = { outcome: 'PARTIAL', acceptedQty: '40', rejectedQty: '5', quarantineQty: '15', reason: 'Cracked bags, wet bags held for test', certificateNo: 'QC-001', checklist: [{ item: 'Bag integrity', passed: false, note: '5 torn' }], attachments: [{ name: 'photo.jpg', ref: 'doc-123' }] };
      expect((await a.ws.put(`/v1/goods-receipts/${grn.id}/lines/${lineId}/inspection`).send(body)).status).toBe(403);
      expect((await a.wm.put(`/v1/goods-receipts/${grn.id}/lines/${lineId}/inspection`).send({ ...body, quarantineQty: '10' })).status).toBe(422);
      expect((await a.wm.put(`/v1/goods-receipts/${grn.id}/lines/${lineId}/inspection`).send({ outcome: 'FAIL' })).status).toBe(400);
      const inspected = await a.wm.put(`/v1/goods-receipts/${grn.id}/lines/${lineId}/inspection`).send(body);
      expect(inspected.status).toBe(200);
      expect(inspected.body.lines[0].inspections[0]).toMatchObject({ outcome: 'PARTIAL', phase: 'RECEIVING', acceptedQty: '40', rejectedQty: '5', quarantineQty: '15', certificateNo: 'QC-001' });

      const posted = await postGrn(a.ws, grn.id);
      expect(posted.lines[0]).toMatchObject({ acceptedQty: '40', rejectedQty: '5', quarantineQty: '15', quarantineOpenQty: '15', qcResult: 'PARTIAL' });
      const totals = await stockOf(a.wm, cement.id);
      expect(totals).toMatchObject({ onHand: '80' });
      const summary = (await a.wm.get(`/v1/items/${cement.id}/stock`)).body.warehouses[0];
      expect(summary).toMatchObject({ onHand: '80', quarantine: '15' });
      // rejected goods are not stocked and stay open on the PO; accepted + quarantined count as received
      const order = await poLine(po);
      expect(order.lines[0]).toMatchObject({ receivedQty: '95', openQty: '5' });
      expect(await ctx.prisma.stockLedger.count({ where: { companyId: w.company.id, itemId: cement.id, stockStatus: 'DAMAGED' } })).toBe(0);

      // quarantine decision: only staff with QC authority, then the stock becomes available
      const decisionBody = { outcome: 'PASS' };
      expect((await a.ws.post(`/v1/goods-receipts/${grn.id}/lines/${lineId}/quarantine-decision`).set('Idempotency-Key', idemKey()).send(decisionBody)).status).toBe(403);
      const released = await a.wm.post(`/v1/goods-receipts/${grn.id}/lines/${lineId}/quarantine-decision`).set('Idempotency-Key', idemKey()).send(decisionBody);
      expect(released.status).toBe(200);
      expect(released.body.lines[0]).toMatchObject({ acceptedQty: '55', quarantineQty: '0', quarantineOpenQty: '0', qcResult: 'PARTIAL' });
      expect(await stockOf(a.wm, cement.id)).toMatchObject({ onHand: '95' });
      const again = await a.wm.post(`/v1/goods-receipts/${grn.id}/lines/${lineId}/quarantine-decision`).set('Idempotency-Key', idemKey()).send(decisionBody);
      expect(again.status).toBe(422);
    });

    it('receives the remainder and completes the PO', async () => {
      await receive(a.ws, po.id, [{ orderLineId: po.lines[0]!.id as string, receivedQty: '5' }]);
      const order = await poLine(po);
      expect(order.status).toBe('RECEIVED');
      expect(await stockOf(a.wm, cement.id)).toMatchObject({ onHand: '100', value: '5100' });
      expect((await createGrnRaw(po.id, '1')).status).toBe(422);
    });

    const createGrnRaw = (orderId: string, qty: string) =>
      a.ws.post('/v1/goods-receipts').send({ orderId, lines: [{ orderLineId: po.lines[0]!.id, receivedQty: qty }] });

    it('records the full trail on the receipt', async () => {
      const trail = await a.wm.get(`/v1/goods-receipts/${grn1.id}/activity`);
      expect(trail.status).toBe(200);
      expect(trail.body.map((t: { action: string }) => t.action)).toEqual(['CREATE', 'POST']);
      const poTrail = await w.buyer.get(`/v1/purchase-orders/${po.id}/activity`);
      expect(poTrail.body.map((t: { action: string }) => t.action)).toEqual(expect.arrayContaining(['RECEIPT_POSTED', 'STATUS_CHANGE']));
    });
  });

  describe('rejected-at-QC goods and quarantine rejection', () => {
    it('FAIL rejects the delivery: nothing is stocked and the PO line stays fully open', async () => {
      const item = await createItem(w.admin, uniq('REJ'), { baseUnit: 'pc' });
      const po = await makeApprovedPo(w, [{ itemId: item.id, qty: '10', unitPrice: '100' }]);
      const grn = (await createGrn(a.ws, po.id, [{ orderLineId: po.lines[0]!.id as string, receivedQty: '10' }])) as Detail;
      await expectOk(await a.wm.put(`/v1/goods-receipts/${grn.id}/lines/${grn.lines[0]!.id}/inspection`).send({ outcome: 'FAIL', reason: 'Wrong grade delivered' }), 200);
      const posted = await postGrn(a.ws, grn.id);
      expect(posted.lines[0]).toMatchObject({ acceptedQty: '0', rejectedQty: '10', qcResult: 'REJECTED' });
      expect(await ctx.prisma.stockLedger.count({ where: { companyId: w.company.id, itemId: item.id } })).toBe(0);
      expect((await poLine(po)).lines[0]).toMatchObject({ receivedQty: '0', openQty: '10' });
    });

    it('rejecting quarantined goods writes them off the stock and reopens the PO quantity', async () => {
      const item = await createItem(w.admin, uniq('QRJ'), { baseUnit: 'pc' });
      const po = await makeApprovedPo(w, [{ itemId: item.id, qty: '10', unitPrice: '100' }]);
      const grn = (await createGrn(a.ws, po.id, [{ orderLineId: po.lines[0]!.id as string, receivedQty: '10' }])) as Detail;
      const lineId = grn.lines[0]!.id;
      await expectOk(await a.wm.put(`/v1/goods-receipts/${grn.id}/lines/${lineId}/inspection`).send({ outcome: 'PARTIAL', acceptedQty: '4', rejectedQty: '0', quarantineQty: '6', reason: 'Awaiting lab result' }), 200);
      await postGrn(a.ws, grn.id);
      expect((await poLine(po)).lines[0]).toMatchObject({ receivedQty: '10', openQty: '0' });
      const decided = await a.wm.post(`/v1/goods-receipts/${grn.id}/lines/${lineId}/quarantine-decision`).set('Idempotency-Key', idemKey()).send({ outcome: 'PARTIAL', acceptedQty: '2', rejectedQty: '3', quarantineQty: '1', reason: 'Lab: 3 failed' });
      expect(decided.body.lines[0]).toMatchObject({ acceptedQty: '6', rejectedQty: '3', quarantineQty: '1', quarantineOpenQty: '1' });
      expect(await stockOf(a.wm, item.id)).toMatchObject({ onHand: '6' });
      expect((await a.wm.get(`/v1/items/${item.id}/stock`)).body.warehouses[0]).toMatchObject({ quarantine: '1' });
      expect((await poLine(po)).lines[0]).toMatchObject({ receivedQty: '7', openQty: '3', });
    });
  });

  describe('over-receipt control', () => {
    it('blocks over-receipt without an override, then needs permission, a reason and the tolerance', async () => {
      const item = await createItem(w.admin, uniq('OVR'), { baseUnit: 'pc' });
      const po = await makeApprovedPo(w, [{ itemId: item.id, qty: '50', unitPrice: '10' }]);
      const line = po.lines[0]!.id as string;
      const grn = (await createGrn(a.ws, po.id, [{ orderLineId: line, receivedQty: '55' }])) as Detail;
      expect(grn.lines[0]).toMatchObject({ remaining: '50', receivingNow: '55', overReceiving: true });

      const plain = await a.ws.post(`/v1/goods-receipts/${grn.id}/post`).set('Idempotency-Key', idemKey()).send({});
      expect(plain.status).toBe(422);
      expect(plain.body.detail).toMatch(/Over-receipt needs an authorised override/);
      // the posting user lacks procurement.receipt:OVERRIDE
      const noRight = await a.ws.post(`/v1/goods-receipts/${grn.id}/post`).set('Idempotency-Key', idemKey()).send({ overReceipt: { reason: 'Extra pallet' } });
      expect(noRight.status).toBe(403);
      // a reason is mandatory
      expect((await a.wm.post(`/v1/goods-receipts/${grn.id}/post`).set('Idempotency-Key', idemKey()).send({ overReceipt: { reason: '' } })).status).toBe(400);
      // 56 > 50 x 1.10
      const tooMuch = (await createGrn(a.ws, po.id, [{ orderLineId: line, receivedQty: '56' }])) as Detail;
      const beyond = await a.wm.post(`/v1/goods-receipts/${tooMuch.id}/post`).set('Idempotency-Key', idemKey()).send({ overReceipt: { reason: 'Supplier sent an extra pallet' } });
      expect(beyond.status).toBe(422);
      expect(beyond.body.detail).toMatch(/tolerance/);

      const ok = await a.wm.post(`/v1/goods-receipts/${grn.id}/post`).set('Idempotency-Key', idemKey()).send({ overReceipt: { reason: 'Supplier sent an extra pallet' } });
      expect(ok.status).toBe(200);
      expect(ok.body).toMatchObject({ overReceiptReason: 'Supplier sent an extra pallet', overReceiptById: a.wmId });
      expect(ok.body.lines[0]).toMatchObject({ overReceivedQty: '5', acceptedQty: '55' });
      expect((await poLine(po)).status).toBe('RECEIVED');
      const trail = await a.wm.get(`/v1/goods-receipts/${grn.id}/activity`);
      expect(trail.body.find((t: { action: string }) => t.action === 'POST')).toMatchObject({ reason: 'Supplier sent an extra pallet' });
    });

    it('the tolerance is configurable per company', async () => {
      const item = await createItem(w.admin, uniq('TOL'), { baseUnit: 'pc' });
      const po = await makeApprovedPo(w, [{ itemId: item.id, qty: '10', unitPrice: '10' }]);
      expect((await w.admin.patch('/v1/company').send({ overReceiptTolerancePct: '0' })).status).toBe(200);
      try {
        const grn = (await createGrn(a.ws, po.id, [{ orderLineId: po.lines[0]!.id as string, receivedQty: '11' }])) as Detail;
        const res = await a.wm.post(`/v1/goods-receipts/${grn.id}/post`).set('Idempotency-Key', idemKey()).send({ overReceipt: { reason: 'One extra unit' } });
        expect(res.status).toBe(422);
        expect(res.body.detail).toMatch(/0% tolerance/);
      } finally {
        await w.admin.patch('/v1/company').send({ overReceiptTolerancePct: '10' });
      }
    });
  });

  describe('batches, expiry and serial numbers', () => {
    it('enforces tracking flags and records the batch', async () => {
      const item = await createItem(w.admin, uniq('BAT'), { baseUnit: 'kg', trackBatch: true, trackExpiry: true });
      const po = await makeApprovedPo(w, [{ itemId: item.id, qty: '100', unitPrice: '5' }]);
      const line = po.lines[0]!.id as string;
      const bad = await a.ws.post('/v1/goods-receipts').send({ orderId: po.id, lines: [{ orderLineId: line, receivedQty: '10' }] });
      expect(bad.status).toBe(422);
      expect(bad.body.errors.map((e: { path: string }) => e.path)).toEqual(expect.arrayContaining(['lines.0.batchNo', 'lines.0.expiryDate']));
      const posted = await receive(a.ws, po.id, [{ orderLineId: line, receivedQty: '10', batchNo: 'LOT-A', expiryDate: '2027-03-31' }]);
      expect(posted.lines[0]).toMatchObject({ batchNo: 'LOT-A', acceptedQty: '10' });
      const batches = await a.wm.get('/v1/inventory/batches').query({ itemId: item.id });
      expect(batches.body.items[0]).toMatchObject({ batchNo: 'LOT-A', onHand: '10', available: '10', expired: false });
      const clash = await createGrn(a.ws, po.id, [{ orderLineId: line, receivedQty: '5', batchNo: 'LOT-A', expiryDate: '2027-04-30' }]);
      const refused = await a.ws.post(`/v1/goods-receipts/${clash.id}/post`).set('Idempotency-Key', idemKey()).send({});
      expect(refused.status).toBe(422);
      expect(refused.body.detail).toMatch(/different expiry/);
    });

    it('requires one serial per unit and creates serial units; duplicates are refused', async () => {
      const item = await createItem(w.admin, uniq('SER'), { baseUnit: 'pc', trackSerial: true, itemType: 'SERIALIZED' });
      const po = await makeApprovedPo(w, [{ itemId: item.id, qty: '6', unitPrice: '1000' }]);
      const line = po.lines[0]!.id as string;
      const short = await a.ws.post('/v1/goods-receipts').send({ orderId: po.id, lines: [{ orderLineId: line, receivedQty: '3', serialNos: ['S1', 'S2'] }] });
      expect(short.status).toBe(422);
      const grn = (await createGrn(a.ws, po.id, [{ orderLineId: line, receivedQty: '3', serialNos: ['SN-A', 'SN-B', 'SN-C'] }])) as Detail;
      await expectOk(await a.wm.put(`/v1/goods-receipts/${grn.id}/lines/${grn.lines[0]!.id}/inspection`).send({ outcome: 'PARTIAL', acceptedQty: '1', rejectedQty: '1', quarantineQty: '1', reason: 'One dented, one held' }), 200);
      await postGrn(a.ws, grn.id);
      const serials = await a.wm.get('/v1/inventory/serials').query({ itemId: item.id });
      expect(serials.body.items.map((s: { serialNo: string; condition: string }) => [s.serialNo, s.condition])).toEqual([['SN-A', 'GOOD'], ['SN-B', 'QUARANTINE']]);
      expect(await stockOf(a.wm, item.id)).toMatchObject({ onHand: '1' });
      const dup = await createGrn(a.ws, po.id, [{ orderLineId: line, receivedQty: '1', serialNos: ['SN-A'] }]);
      const res = await a.ws.post(`/v1/goods-receipts/${dup.id}/post`).set('Idempotency-Key', idemKey()).send({});
      expect(res.status).toBe(422);
      expect(res.body.detail).toMatch(/already exist/);
      // rejected serial SN-C never became a unit
      expect(await ctx.prisma.serialUnit.count({ where: { companyId: w.company.id, itemId: item.id } })).toBe(2);
    });
  });

  describe('units of measure', () => {
    it('receives in the PO unit, stocks in the base unit and costs per base unit', async () => {
      const item = await createItem(w.admin, uniq('BOX'), { baseUnit: 'pc', purchaseUnit: 'box', conversionFactor: '12' });
      const po = await makeApprovedPo(w, [{ itemId: item.id, qty: '10', unitPrice: '120', unit: 'box' }]);
      const line = po.lines[0]!.id as string;
      const grn = await receive(a.ws, po.id, [{ orderLineId: line, receivedQty: '4' }]);
      expect(grn.lines[0]).toMatchObject({ unit: 'box', acceptedQty: '4', unitCost: '120' });
      // 4 boxes x 12 = 48 pieces at 10 each
      const row = (await a.wm.get('/v1/inventory/stock-balances').query({ itemId: item.id })).body.items[0];
      expect(row).toMatchObject({ onHand: '48', value: '480', avgCost: '10', baseUnit: 'pc', committed: '72' });
      expect((await poLine(po)).lines[0]).toMatchObject({ receivedQty: '4', openQty: '6' });
      expect((await w.admin.get(`/v1/items/${item.id}`)).body.lastPurchaseCost).toBe('10');
      // last purchase cost is per base unit, so a requisition line in boxes estimates 12 x 10
      const pr = await w.engineer.post('/v1/requisitions').send({ projectId: w.project.id, lines: [{ itemId: item.id, qty: '2', unit: 'box' }] });
      expect(pr.body.lines[0]).toMatchObject({ estimatedUnitCost: '120', estimatedAmount: '240' });
      // an issue in pieces draws 30 of the 48
      const issue = await a.wm.post('/v1/material-issues').send({ projectId: w.project.id, warehouseId: w.warehouse.id, remarks: 'Loose pieces for the crew', lines: [{ itemId: item.id, qty: '30' }] });
      const posted = await a.wm.post(`/v1/material-issues/${issue.body.id}/post`).set('Idempotency-Key', idemKey()).send({});
      expect(posted.body).toMatchObject({ status: 'POSTED', totalCost: '300' });
      expect(await stockOf(a.wm, item.id)).toMatchObject({ onHand: '18' });
    });

    it('posting endpoints demand an Idempotency-Key', async () => {
      const po = await makeApprovedPo(w, [{ itemId: cement.id, qty: '3', unitPrice: '10' }]);
      const g = await createGrn(a.ws, po.id, [{ orderLineId: po.lines[0]!.id as string, receivedQty: '3' }]);
      expect((await a.ws.post(`/v1/goods-receipts/${g.id}/post`).send({})).status).toBe(400);
      expect((await a.ws.post(`/v1/goods-receipts/${g.id}/post`).set('Idempotency-Key', 'short').send({})).status).toBe(400);
    });
  });

  describe('reversal', () => {
    it('cancelling a posted receipt reverses stock and restores the PO quantities', async () => {
      const item = await createItem(w.admin, uniq('REV'), { baseUnit: 'pc' });
      const po = await makeApprovedPo(w, [{ itemId: item.id, qty: '20', unitPrice: '10' }]);
      const grn = await receive(a.ws, po.id, [{ orderLineId: po.lines[0]!.id as string, receivedQty: '20' }]);
      expect((await poLine(po)).status).toBe('RECEIVED');
      expect((await a.ws.post(`/v1/goods-receipts/${grn.id}/cancel`).set('Idempotency-Key', idemKey()).send({ reason: 'Wrong site' })).status).toBe(403);
      expect((await a.wm.post(`/v1/goods-receipts/${grn.id}/cancel`).set('Idempotency-Key', idemKey()).send({ reason: 'x' })).status).toBe(400);
      const res = await a.wm.post(`/v1/goods-receipts/${grn.id}/cancel`).set('Idempotency-Key', idemKey()).send({ reason: 'Delivered to the wrong site' });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('CANCELLED');
      expect(await stockOf(a.wm, item.id)).toMatchObject({ onHand: '0', value: '0' });
      const order = await poLine(po);
      expect(order.status).toBe('APPROVED');
      expect(order.lines[0]).toMatchObject({ receivedQty: '0', openQty: '20' });
      const ledger = await ctx.prisma.stockLedger.findMany({ where: { companyId: w.company.id, itemId: item.id }, orderBy: { createdAt: 'asc' } });
      expect(ledger.map((r) => r.txnType).sort()).toEqual(['PURCHASE_RECEIPT', 'REVERSAL']);
      expect((await a.wm.post(`/v1/goods-receipts/${grn.id}/cancel`).set('Idempotency-Key', idemKey()).send({ reason: 'again please' })).status).toBe(422);
      // and the PO can be received against again
      await receive(a.ws, po.id, [{ orderLineId: po.lines[0]!.id as string, receivedQty: '20' }]);
      expect(await stockOf(a.wm, item.id)).toMatchObject({ onHand: '20' });
    });

    it('is blocked once the stock has been consumed', async () => {
      const item = await createItem(w.admin, uniq('USED'), { baseUnit: 'pc' });
      const po = await makeApprovedPo(w, [{ itemId: item.id, qty: '10', unitPrice: '10' }]);
      const grn = await receive(a.ws, po.id, [{ orderLineId: po.lines[0]!.id as string, receivedQty: '10' }]);
      const adj = await expectOk<Json>(await a.wm.post('/v1/stock-adjustments').send({ warehouseId: w.warehouse.id, reason: 'Stock used on site without paperwork', lines: [{ itemId: item.id, qtyDelta: '-4' }] }), 201);
      await expectOk(await a.wm.post(`/v1/stock-adjustments/${adj.id}/post`).set('Idempotency-Key', idemKey()).send({}), 200);
      const res = await a.wm.post(`/v1/goods-receipts/${grn.id}/cancel`).set('Idempotency-Key', idemKey()).send({ reason: 'Wrong delivery' });
      expect(res.status).toBe(422);
      expect(res.body.detail).toMatch(/already been used/);
      expect(await stockOf(a.wm, item.id)).toMatchObject({ onHand: '6' });
      expect((await poLine(po)).lines[0]).toMatchObject({ receivedQty: '10' });
    });

    it('cancelling a draft stocks nothing', async () => {
      const po = await makeApprovedPo(w, [{ itemId: cement.id, qty: '5', unitPrice: '10' }]);
      const grn = await createGrn(a.ws, po.id, [{ orderLineId: po.lines[0]!.id as string, receivedQty: '5' }]);
      const res = await a.wm.post(`/v1/goods-receipts/${grn.id}/cancel`).set('Idempotency-Key', idemKey()).send({ reason: 'Not delivered after all' });
      expect(res.body.status).toBe('CANCELLED');
      expect((await a.ws.post(`/v1/goods-receipts/${grn.id}/post`).set('Idempotency-Key', idemKey()).send({})).status).toBe(422);
    });
  });

  describe('concurrency', () => {
    it('two simultaneous receipts for the same PO line cannot over-receive it', async () => {
      const item = await createItem(w.admin, uniq('CON'), { baseUnit: 'pc' });
      const po = await makeApprovedPo(w, [{ itemId: item.id, qty: '100', unitPrice: '10' }]);
      const line = po.lines[0]!.id as string;
      const g1 = await createGrn(a.ws, po.id, [{ orderLineId: line, receivedQty: '70' }]);
      const g2 = await createGrn(a.ws, po.id, [{ orderLineId: line, receivedQty: '70' }]);
      const results = await Promise.all([g1, g2].map((g) => a.ws.post(`/v1/goods-receipts/${g.id}/post`).set('Idempotency-Key', idemKey()).send({})));
      expect(results.map((r) => r.status).sort()).toEqual([200, 422]);
      expect((await poLine(po)).lines[0]).toMatchObject({ receivedQty: '70', openQty: '30' });
      expect(await stockOf(a.wm, item.id)).toMatchObject({ onHand: '70' });
    });

    it('double-clicking post (same key, concurrent) runs once', async () => {
      const item = await createItem(w.admin, uniq('DBL'), { baseUnit: 'pc' });
      const po = await makeApprovedPo(w, [{ itemId: item.id, qty: '10', unitPrice: '10' }]);
      const g = await createGrn(a.ws, po.id, [{ orderLineId: po.lines[0]!.id as string, receivedQty: '10' }]);
      const key = idemKey('same');
      const results = await Promise.all([1, 2, 3].map(() => a.ws.post(`/v1/goods-receipts/${g.id}/post`).set('Idempotency-Key', key).send({})));
      expect(results.filter((r) => r.status === 200).length).toBeGreaterThanOrEqual(1);
      expect(results.every((r) => [200, 409].includes(r.status))).toBe(true);
      expect(await stockOf(a.wm, item.id)).toMatchObject({ onHand: '10' });
      expect(await ctx.prisma.stockLedger.count({ where: { companyId: w.company.id, itemId: item.id } })).toBe(1);
    });

    it('simultaneous receipts of different POs for one item both land', async () => {
      const item = await createItem(w.admin, uniq('PAR'), { baseUnit: 'pc' });
      const [po1, po2] = await Promise.all([
        makeApprovedPo(w, [{ itemId: item.id, qty: '30', unitPrice: '10' }]),
        makeApprovedPo(w, [{ itemId: item.id, qty: '20', unitPrice: '20' }]),
      ]);
      const [g1, g2] = await Promise.all([
        createGrn(a.ws, po1.id, [{ orderLineId: po1.lines[0]!.id as string, receivedQty: '30' }]),
        createGrn(a.ws, po2.id, [{ orderLineId: po2.lines[0]!.id as string, receivedQty: '20' }]),
      ]);
      const results = await Promise.all([g1, g2].map((g) => a.ws.post(`/v1/goods-receipts/${g.id}/post`).set('Idempotency-Key', idemKey()).send({})));
      expect(results.map((r) => r.status)).toEqual([200, 200]);
      // weighted average of 30 @ 10 and 20 @ 20
      const row = (await a.wm.get('/v1/inventory/stock-balances').query({ itemId: item.id })).body.items[0];
      expect(row).toMatchObject({ onHand: '50', value: '700', avgCost: '14' });
    });
  });

  describe('access control and validation', () => {
    let po: Json & { lines: Json[] };
    beforeAll(async () => {
      po = await makeApprovedPo(w, [{ itemId: cement.id, qty: '10', unitPrice: '10' }]);
    });

    it('requires authentication', async () => {
      expect((await ctx.http().get('/v1/goods-receipts')).status).toBe(401);
      expect((await ctx.http().post('/v1/goods-receipts').send({})).status).toBe(401);
      expect((await ctx.http().get(`/v1/purchase-orders/${po.id}/receivable-lines`)).status).toBe(401);
    });

    it('rejects users without receipt permissions', async () => {
      expect((await w.viewer.get('/v1/goods-receipts')).status).toBe(403);
      const res = await w.viewer.post('/v1/goods-receipts').send({ orderId: po.id, lines: [{ orderLineId: po.lines[0]!.id, receivedQty: '1' }] });
      expect(res.status).toBe(403);
    });

    it('validates input with problem details', async () => {
      const zero = await a.ws.post('/v1/goods-receipts').send({ orderId: po.id, lines: [{ orderLineId: po.lines[0]!.id, receivedQty: '0' }] });
      expect(zero.status).toBe(400);
      expect(zero.body).toMatchObject({ status: 400 });
      expect((await a.ws.post('/v1/goods-receipts').send({ orderId: 'nope', lines: [] })).status).toBe(400);
      expect((await a.ws.post('/v1/goods-receipts').send({ orderId: po.id, lines: [{ orderLineId: po.lines[0]!.id, receivedQty: '1.00001' }] })).status).toBe(400);
      const foreign = await a.ws.post('/v1/goods-receipts').send({ orderId: po.id, lines: [{ orderLineId: '00000000-0000-4000-8000-000000000000', receivedQty: '1' }] });
      expect(foreign.status).toBe(422);
      const rejectedTooMany = await a.ws.post('/v1/goods-receipts').send({ orderId: po.id, lines: [{ orderLineId: po.lines[0]!.id, receivedQty: '2', rejectedQty: '3' }] });
      expect(rejectedTooMany.status).toBe(422);
    });

    it('is invisible to another company', async () => {
      const g = await createGrn(a.ws, po.id, [{ orderLineId: po.lines[0]!.id as string, receivedQty: '1' }]);
      expect((await rival.admin.get(`/v1/goods-receipts/${g.id}`)).status).toBe(404);
      expect((await rival.admin.post(`/v1/goods-receipts/${g.id}/post`).set('Idempotency-Key', idemKey()).send({})).status).toBe(404);
      expect((await rival.admin.post(`/v1/goods-receipts/${g.id}/cancel`).set('Idempotency-Key', idemKey()).send({ reason: 'sabotage' })).status).toBe(404);
      expect((await rival.admin.get(`/v1/purchase-orders/${po.id}/receivable-lines`)).status).toBe(404);
      expect((await rival.admin.post('/v1/goods-receipts').send({ orderId: po.id, lines: [{ orderLineId: po.lines[0]!.id, receivedQty: '1' }] })).status).toBe(404);
      expect((await rival.admin.get('/v1/goods-receipts')).body.items).toHaveLength(0);
    });

    it('respects warehouse scope', async () => {
      const other = await createWarehouse(ctx.prisma, w.company, uniq('OTH'));
      const scoped = await userAgent(w, ['Warehouse Manager'], { warehouseId: other.id });
      const g = await createGrn(a.ws, po.id, [{ orderLineId: po.lines[0]!.id as string, receivedQty: '1' }]);
      expect((await scoped.agent.get(`/v1/goods-receipts/${g.id}`)).status).toBe(403);
      expect((await scoped.agent.post('/v1/goods-receipts').send({ orderId: po.id, lines: [{ orderLineId: po.lines[0]!.id, receivedQty: '1' }] })).status).toBe(403);
      expect((await scoped.agent.get('/v1/goods-receipts')).body.items).toHaveLength(0);
      const mine = await userAgent(w, ['Warehouse Manager'], { warehouseId: w.warehouse.id });
      expect((await mine.agent.get(`/v1/goods-receipts/${g.id}`)).status).toBe(200);
    });

    it('respects project scope', async () => {
      const scoped = await userAgent(w, ['Warehouse Manager'], { projectId: w.otherProject.id });
      const g = await createGrn(a.ws, po.id, [{ orderLineId: po.lines[0]!.id as string, receivedQty: '1' }]);
      expect((await scoped.agent.get(`/v1/goods-receipts/${g.id}`)).status).toBe(403);
      expect((await scoped.agent.post(`/v1/goods-receipts/${g.id}/post`).set('Idempotency-Key', idemKey()).send({})).status).toBe(403);
    });

    it('refuses a purchase order that is not receivable', async () => {
      const draftPo = await makeApprovedPo(w, [{ itemId: cement.id, qty: '5', unitPrice: '10' }]);
      await expectOk(await w.buyer.post(`/v1/purchase-orders/${draftPo.id}/cancel`).send({ reason: 'Supplier withdrew' }), 200);
      const res = await a.ws.post('/v1/goods-receipts').send({ orderId: draftPo.id, lines: [{ orderLineId: draftPo.lines[0]!.id, receivedQty: '1' }] });
      expect(res.status).toBe(422);
      expect(res.body.detail).toMatch(/approved, sent or part-received/);
    });

    it('lists with filters and cursor pagination', async () => {
      const first = await a.wm.get('/v1/goods-receipts').query({ limit: 2, status: 'DRAFT' });
      expect(first.status).toBe(200);
      expect(first.body.items).toHaveLength(2);
      expect(first.body.nextCursor).toBeTruthy();
      const second = await a.wm.get('/v1/goods-receipts').query({ limit: 2, status: 'DRAFT', cursor: first.body.nextCursor });
      expect(second.body.items.every((i: Json) => !first.body.items.some((f: Json) => f.id === i.id))).toBe(true);
      expect((await a.wm.get('/v1/goods-receipts').query({ orderId: po.id })).body.items.every((i: Json) => i.orderId === po.id)).toBe(true);
      expect((await a.wm.get('/v1/goods-receipts').query({ sort: 'bogus:asc' })).status).toBe(400);
    });
  });
});
