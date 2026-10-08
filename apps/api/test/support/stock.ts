import { Agent, createSupplier, expectOk, idemKey, Json, uniq, userAgent, World } from './world';

/** Warehouse people for the Stage F-J suites: a manager (may override, adjust, approve QC) and a staff member. */
export type StockActors = { wm: Agent; ws: Agent; wmId: string; wsId: string };

export async function stockActors(w: World, scope: { warehouseId?: string; projectId?: string } = {}): Promise<StockActors> {
  const wm = await userAgent(w, ['Warehouse Manager'], scope);
  const ws = await userAgent(w, ['Warehouse Staff'], scope);
  return { wm: wm.agent, ws: ws.agent, wmId: wm.id, wsId: ws.id };
}

export type PoLineSpec = { itemId: string; qty: string; unitPrice: string; unit?: string; discountPct?: string; taxPct?: string };

/**
 * An approved purchase order for the world's project, raised the real way: requisition -> auto-approved (no workflow) ->
 * PO from requisition lines -> submit -> approved. Requires that the world has no PR / PO workflow configured.
 */
export async function makeApprovedPo(
  w: World,
  specs: PoLineSpec[],
  opts: { freight?: string; supplierId?: string; warehouseId?: string; send?: boolean } = {},
): Promise<Json & { lines: Json[] }> {
  const supplierId = opts.supplierId ?? (await createSupplier(w.admin)).id;
  const warehouseId = opts.warehouseId ?? w.warehouse.id;
  const pr = await expectOk<Json & { lines: Json[] }>(
    await w.engineer.post('/v1/requisitions').send({
      projectId: w.project.id, warehouseId,
      lines: specs.map((s) => ({ itemId: s.itemId, qty: s.qty, ...(s.unit ? { unit: s.unit } : {}) })),
    }),
  );
  const submitted = await expectOk<Json>(await w.engineer.post(`/v1/requisitions/${pr.id}/submit`).set('Idempotency-Key', idemKey('pr')).send({}), 200);
  if (submitted.status !== 'APPROVED') throw new Error(`Requisition not auto-approved (${String(submitted.status)}); the world must have no PR workflow`);
  const draft = await expectOk<Json>(
    await w.buyer.post('/v1/purchase-orders').set('Idempotency-Key', idemKey('po')).send({
      source: 'REQUISITION', requisitionId: pr.id, supplierId, warehouseId,
      ...(opts.freight ? { freight: opts.freight } : {}),
      lines: pr.lines.map((l, i) => ({
        requisitionLineId: l.id, qty: specs[i]!.qty, unitPrice: specs[i]!.unitPrice,
        ...(specs[i]!.discountPct ? { discountPct: specs[i]!.discountPct } : {}), ...(specs[i]!.taxPct ? { taxPct: specs[i]!.taxPct } : {}),
      })),
    }),
  );
  const approved = await expectOk<Json>(await w.buyer.post(`/v1/purchase-orders/${draft.id}/submit`).set('Idempotency-Key', idemKey('po-sub')).send({}), 200);
  if (approved.status !== 'APPROVED') throw new Error(`PO not auto-approved (${String(approved.status)}); the world must have no PO workflow`);
  if (opts.send) await expectOk(await w.buyer.post(`/v1/purchase-orders/${draft.id}/send`).send({}), 200);
  return expectOk<Json & { lines: Json[] }>(await w.buyer.get(`/v1/purchase-orders/${draft.id}`), 200);
}

export type ReceiptLineSpec = Record<string, unknown> & { orderLineId: string; receivedQty: string };

export async function createGrn(agent: Agent, orderId: string, lines: ReceiptLineSpec[], extra: Record<string, unknown> = {}): Promise<Json & { lines: Json[] }> {
  return expectOk<Json & { lines: Json[] }>(await agent.post('/v1/goods-receipts').send({ orderId, lines, supplierDrNo: uniq('DR'), ...extra }), 201);
}

export async function postGrn(agent: Agent, id: string, body: Record<string, unknown> = {}): Promise<Json & { lines: Json[] }> {
  return expectOk<Json & { lines: Json[] }>(await agent.post(`/v1/goods-receipts/${id}/post`).set('Idempotency-Key', idemKey('grn')).send(body), 200);
}

/** Receives and posts a delivery in one go. */
export async function receive(agent: Agent, orderId: string, lines: ReceiptLineSpec[], body: Record<string, unknown> = {}): Promise<Json & { lines: Json[] }> {
  const grn = await createGrn(agent, orderId, lines);
  return postGrn(agent, grn.id, body);
}

/** Puts stock into a warehouse through a real PO + receipt. Returns the posted receipt. */
export async function stockUp(w: World, actors: StockActors, specs: Array<PoLineSpec & { batchNo?: string; expiryDate?: string; serialNos?: string[] }>, opts: { warehouseId?: string; freight?: string } = {}) {
  const po = await makeApprovedPo(w, specs, opts);
  const grn = await receive(
    actors.wm,
    po.id,
    po.lines.map((l, i) => ({
      orderLineId: l.id, receivedQty: specs[i]!.qty,
      ...(specs[i]!.batchNo ? { batchNo: specs[i]!.batchNo } : {}), ...(specs[i]!.expiryDate ? { expiryDate: specs[i]!.expiryDate } : {}),
      ...(specs[i]!.serialNos ? { serialNos: specs[i]!.serialNos } : {}),
    })),
  );
  return { po, grn };
}

export async function stockOf(agent: Agent, itemId: string, warehouseId?: string): Promise<Record<string, string>> {
  const res = await agent.get(`/v1/items/${itemId}/stock`).query(warehouseId ? { warehouseId } : {});
  return (await expectOk<{ totals: Record<string, string> }>(res, 200)).totals;
}

export type ProjectDims = { wbs: Json; costCode: Json; boq: Json; estimate: Json };

/** WBS node, cost code and an APPROVED BOQ item (which also creates the project budget) for a project. */
export async function projectDims(w: World, projectId = w.project.id, boqAmount = { quantity: '10', unitRate: '1000' }): Promise<ProjectDims> {
  const wbs = await expectOk<Json>(await w.admin.post(`/v1/projects/${projectId}/wbs`).send({ code: uniq('W'), name: 'Substructure' }));
  const costCode = await expectOk<Json>(await w.admin.post('/v1/cost-codes').send({ code: uniq('03-300'), name: 'Cast-in-place concrete', category: 'MATERIAL' }));
  const estimate = await expectOk<Json>(await w.admin.post(`/v1/projects/${projectId}/estimates`).send({ name: 'Approved estimate', overheadPct: '8', profitPct: '10', taxPct: '12' }));
  const boq = await expectOk<Json>(
    await w.admin.post(`/v1/estimates/${estimate.id}/items`).send({
      itemNo: 'B-1', description: 'Concrete works', unit: 'm3', ...boqAmount, wbsNodeId: wbs.id, costCodeId: costCode.id, costCategory: 'MATERIAL',
    }),
  );
  await expectOk(await w.admin.post(`/v1/estimates/${estimate.id}/approve`).send({}));
  return { wbs, costCode, boq, estimate };
}
