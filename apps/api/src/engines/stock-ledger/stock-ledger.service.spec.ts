import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { BusinessRuleError } from '../../common/errors/domain-errors';
import { Db } from '../../prisma/prisma.service';
import { NumberingService } from '../numbering/numbering.service';
import { StockLedgerService } from './stock-ledger.service';

const D = Prisma.Decimal;

/** Minimal in-memory Db covering only what StockLedgerService touches. */
function fakeDb() {
  const balances = new Map<string, { qtyOnHand: Prisma.Decimal; value: Prisma.Decimal; avgCost: Prisma.Decimal }>();
  const ledger: Array<Record<string, unknown>> = [];
  const keyOf = (w: { warehouseId: string; itemId: string; batchNo: string; stockStatus: string }) =>
    `${w.warehouseId}|${w.itemId}|${w.batchNo}|${w.stockStatus}`;

  const db = {
    item: { findFirst: async () => ({ id: 'i1', sku: 'CEM', trackBatch: false, trackSerial: false, restrictedProjectId: null, costingMethod: 'WEIGHTED_AVERAGE', standardCost: new D(0) }) },
    warehouse: { findFirst: async () => ({ id: 'w1' }) },
    $queryRaw: async () => [],
    $executeRaw: async () => 0,
    stockBalance: {
      findUnique: async ({ where }: { where: { warehouseId_itemId_batchNo_stockStatus: Parameters<typeof keyOf>[0] } }) =>
        balances.get(keyOf(where.warehouseId_itemId_batchNo_stockStatus)) ?? null,
      upsert: async ({ where, create, update }: { where: { warehouseId_itemId_batchNo_stockStatus: Parameters<typeof keyOf>[0] }; create: Record<string, Prisma.Decimal>; update: Record<string, Prisma.Decimal> }) => {
        const k = keyOf(where.warehouseId_itemId_batchNo_stockStatus);
        const next = balances.has(k) ? update : create;
        balances.set(k, { qtyOnHand: next.qtyOnHand as Prisma.Decimal, value: next.value as Prisma.Decimal, avgCost: next.avgCost as Prisma.Decimal });
      },
    },
    stockLedger: { create: async ({ data }: { data: Record<string, unknown> }) => { ledger.push(data); return data; } },
  } as unknown as Db;
  return { db, balances, ledger };
}

const numbering = { next: async () => 'STK-2026-00001' } as unknown as NumberingService;
const base = { companyId: 'c1', txnDate: new Date(), warehouseId: 'w1', itemId: 'i1', sourceType: 'T', sourceId: 's', userId: 'u1' };

describe('StockLedgerService', () => {
  it('values inbound stock at the given unit cost', async () => {
    const { db, balances } = fakeDb();
    const svc = new StockLedgerService(numbering);
    await svc.post(db, [{ ...base, txnType: 'PURCHASE_RECEIPT', qty: 100, unitCost: 10 }]);
    const bal = [...balances.values()][0]!;
    expect(bal.qtyOnHand.toString()).toBe('100');
    expect(bal.value.toString()).toBe('1000');
  });

  it('issues at weighted average cost', async () => {
    const { db, balances } = fakeDb();
    const svc = new StockLedgerService(numbering);
    await svc.post(db, [
      { ...base, txnType: 'PURCHASE_RECEIPT', qty: 100, unitCost: 10 },
      { ...base, txnType: 'PURCHASE_RECEIPT', qty: 100, unitCost: 20 },
    ]);
    const [issue] = await svc.post(db, [{ ...base, txnType: 'PROJECT_ISSUE', qty: -50 }]);
    expect(String((issue as { unitCost: Prisma.Decimal }).unitCost)).toBe('15');
    expect([...balances.values()][0]!.value.toString()).toBe('2250');
  });

  it('rejects issuing more than on hand', async () => {
    const { db } = fakeDb();
    const svc = new StockLedgerService(numbering);
    await svc.post(db, [{ ...base, txnType: 'PURCHASE_RECEIPT', qty: 10, unitCost: 5 }]);
    await expect(svc.post(db, [{ ...base, txnType: 'PROJECT_ISSUE', qty: -11 }])).rejects.toBeInstanceOf(BusinessRuleError);
  });

  it('drains value exactly when the whole balance is issued', async () => {
    const { db, balances } = fakeDb();
    const svc = new StockLedgerService(numbering);
    await svc.post(db, [{ ...base, txnType: 'PURCHASE_RECEIPT', qty: 3, unitCost: 3.3333 }]);
    await svc.post(db, [{ ...base, txnType: 'PROJECT_ISSUE', qty: -3 }]);
    const bal = [...balances.values()][0]!;
    expect(bal.qtyOnHand.isZero()).toBe(true);
    expect(bal.value.isZero()).toBe(true);
  });

  it('requires a unit cost for inbound stock and rejects zero quantity', async () => {
    const { db } = fakeDb();
    const svc = new StockLedgerService(numbering);
    await expect(svc.post(db, [{ ...base, txnType: 'PURCHASE_RECEIPT', qty: 5 }])).rejects.toBeInstanceOf(BusinessRuleError);
    await expect(svc.post(db, [{ ...base, txnType: 'PURCHASE_RECEIPT', qty: 0, unitCost: 1 }])).rejects.toBeInstanceOf(BusinessRuleError);
  });
});
