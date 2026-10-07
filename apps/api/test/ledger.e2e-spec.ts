import { Prisma } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { BusinessRuleError } from '../src/common/errors/domain-errors';
import { CostLedgerService } from '../src/engines/cost-ledger/cost-ledger.service';
import { StockLedgerService } from '../src/engines/stock-ledger/stock-ledger.service';
import { startApp, stopApp, TestContext } from './support/app';
import { createCompany, createCustomerAndProject, createItem, createWarehouse, TestCompany } from './support/fixtures';

describe('Immutable ledgers and stock concurrency', () => {
  let ctx: TestContext;
  let company: TestCompany;
  let stock: StockLedgerService;
  let cost: CostLedgerService;

  beforeAll(async () => {
    ctx = await startApp();
    company = await createCompany(ctx.prisma, 'Ledger');
    stock = ctx.app.get(StockLedgerService);
    cost = ctx.app.get(CostLedgerService);
  });
  afterAll(() => stopApp(ctx));

  const receipt = (warehouseId: string, itemId: string, qty: number, unitCost: number) => ({
    companyId: company.id, txnDate: new Date(), txnType: 'PURCHASE_RECEIPT' as const, warehouseId, itemId, qty, unitCost,
    sourceType: 'TEST', sourceId: `r-${Math.random()}`, userId: 'u1',
  });
  const issue = (warehouseId: string, itemId: string, qty: number) => ({
    companyId: company.id, txnDate: new Date(), txnType: 'PROJECT_ISSUE' as const, warehouseId, itemId, qty: -qty,
    sourceType: 'TEST', sourceId: `i-${Math.random()}`, userId: 'u1',
  });

  describe('append-only enforcement in the database', () => {
    it('blocks UPDATE, DELETE and TRUNCATE on the stock ledger', async () => {
      const wh = await createWarehouse(ctx.prisma, company, 'IMM1');
      const item = await createItem(ctx.prisma, company, 'IMM-1');
      const [row] = await ctx.prisma.$transaction((tx) => stock.post(tx, [receipt(wh.id, item.id, 5, 10)]));
      await expect(ctx.prisma.stockLedger.update({ where: { id: row!.id }, data: { qty: 999 } })).rejects.toThrow(/immutable/i);
      await expect(ctx.prisma.stockLedger.delete({ where: { id: row!.id } })).rejects.toThrow(/immutable/i);
      await expect(ctx.prisma.$executeRawUnsafe('TRUNCATE "StockLedger" CASCADE')).rejects.toThrow(/TRUNCATE is not allowed/i);
    });

    it('blocks UPDATE and DELETE on the project cost ledger and audit log', async () => {
      const { project } = await createCustomerAndProject(ctx.prisma, company, 'IMM2');
      const row = await ctx.prisma.$transaction((tx) =>
        cost.record(tx, { companyId: company.id, projectId: project.id, costCategory: 'MATERIAL', txnType: 'MATERIAL_ISSUE', txnDate: new Date(), totalCost: 250, sourceType: 'T', sourceId: 's', userId: 'u' }),
      );
      await expect(ctx.prisma.projectCostLedger.update({ where: { id: row.id }, data: { totalCost: 1 } })).rejects.toThrow(/immutable/i);
      await expect(ctx.prisma.projectCostLedger.delete({ where: { id: row.id } })).rejects.toThrow(/immutable/i);

      const audit = await ctx.prisma.auditLog.create({ data: { entityType: 'T', entityId: 'x', action: 'A' } });
      await expect(ctx.prisma.auditLog.update({ where: { id: audit.id }, data: { action: 'B' } })).rejects.toThrow(/immutable/i);
      await expect(ctx.prisma.auditLog.delete({ where: { id: audit.id } })).rejects.toThrow(/immutable/i);
    });

    it('only allows POSTED -> REVERSED on a journal entry header, and never edits lines', async () => {
      const cash = await ctx.prisma.account.findFirstOrThrow({ where: { companyId: company.id, code: '1000' } });
      const rev = await ctx.prisma.account.findFirstOrThrow({ where: { companyId: company.id, code: '4000' } });
      const entry = await ctx.prisma.journalEntry.create({
        data: {
          companyId: company.id, entryNo: `JE-IMM-${Date.now()}`, entryDate: new Date(), description: 'immutable?', postedById: 'u',
          lines: { create: [{ accountId: cash.id, debit: 100 }, { accountId: rev.id, credit: 100 }] },
        },
        include: { lines: true },
      });
      await expect(ctx.prisma.journalEntry.update({ where: { id: entry.id }, data: { description: 'tampered' } })).rejects.toThrow(/immutable/i);
      await expect(ctx.prisma.journalLine.update({ where: { id: entry.lines[0]!.id }, data: { debit: 1 } })).rejects.toThrow(/immutable/i);
      await expect(ctx.prisma.journalEntry.delete({ where: { id: entry.id } })).rejects.toThrow(/cannot be deleted/i);
      await expect(ctx.prisma.journalEntry.update({ where: { id: entry.id }, data: { status: 'DRAFT' } })).rejects.toThrow();
      await expect(ctx.prisma.journalEntry.update({ where: { id: entry.id }, data: { status: 'REVERSED' } })).resolves.toBeTruthy();
    });
  });

  describe('stock ledger behaviour', () => {
    it('serializes simultaneous issues: exactly the available quantity succeeds, never negative', async () => {
      const wh = await createWarehouse(ctx.prisma, company, 'CONC1');
      const item = await createItem(ctx.prisma, company, 'CONC-1');
      await ctx.prisma.$transaction((tx) => stock.post(tx, [receipt(wh.id, item.id, 10, 5)]));

      const results = await Promise.allSettled(
        Array.from({ length: 20 }, () => ctx.prisma.$transaction((tx) => stock.post(tx, [issue(wh.id, item.id, 1)]))),
      );
      const ok = results.filter((r) => r.status === 'fulfilled').length;
      const rejected = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
      expect(ok).toBe(10);
      expect(rejected).toHaveLength(10);
      expect(rejected.every((r) => r.reason instanceof BusinessRuleError)).toBe(true);

      const balance = await ctx.prisma.stockBalance.findFirstOrThrow({ where: { warehouseId: wh.id, itemId: item.id } });
      expect(balance.qtyOnHand.toString()).toBe('0');
      expect(balance.value.toString()).toBe('0');
    });

    it('handles simultaneous first receipts for a brand-new bucket without losing updates', async () => {
      const wh = await createWarehouse(ctx.prisma, company, 'CONC2');
      const item = await createItem(ctx.prisma, company, 'CONC-2');
      const results = await Promise.allSettled(
        Array.from({ length: 15 }, () => ctx.prisma.$transaction((tx) => stock.post(tx, [receipt(wh.id, item.id, 2, 10)]))),
      );
      expect(results.every((r) => r.status === 'fulfilled')).toBe(true);
      const balance = await ctx.prisma.stockBalance.findFirstOrThrow({ where: { warehouseId: wh.id, itemId: item.id } });
      expect(balance.qtyOnHand.toString()).toBe('30');
      expect(balance.value.toString()).toBe('300');
    });

    it('keeps StockBalance equal to the sum of the ledger (reconciliation)', async () => {
      const wh = await createWarehouse(ctx.prisma, company, 'REC1');
      const item = await createItem(ctx.prisma, company, 'REC-1');
      await ctx.prisma.$transaction((tx) => stock.post(tx, [receipt(wh.id, item.id, 100, 12.5), receipt(wh.id, item.id, 50, 14)]));
      await ctx.prisma.$transaction((tx) => stock.post(tx, [issue(wh.id, item.id, 70)]));

      const sums = await ctx.prisma.stockLedger.aggregate({ where: { warehouseId: wh.id, itemId: item.id }, _sum: { qty: true, value: true } });
      const balance = await ctx.prisma.stockBalance.findFirstOrThrow({ where: { warehouseId: wh.id, itemId: item.id } });
      expect(balance.qtyOnHand.equals(sums._sum.qty ?? 0)).toBe(true);
      expect(balance.value.equals(sums._sum.value ?? 0)).toBe(true);
    });

    it('reverses a document by appending opposite rows and refuses a second reversal', async () => {
      const wh = await createWarehouse(ctx.prisma, company, 'REV1');
      const item = await createItem(ctx.prisma, company, 'REV-1');
      const sourceId = `doc-${Date.now()}`;
      await ctx.prisma.$transaction((tx) => stock.post(tx, [{ ...receipt(wh.id, item.id, 8, 20), sourceId }]));
      await ctx.prisma.$transaction((tx) => stock.reverse(tx, { companyId: company.id, sourceType: 'TEST', sourceId, userId: 'u', reason: 'wrong supplier' }));

      const balance = await ctx.prisma.stockBalance.findFirstOrThrow({ where: { warehouseId: wh.id, itemId: item.id } });
      expect(balance.qtyOnHand.toString()).toBe('0');
      expect(await ctx.prisma.stockLedger.count({ where: { warehouseId: wh.id, itemId: item.id } })).toBe(2);
      await expect(
        ctx.prisma.$transaction((tx) => stock.reverse(tx, { companyId: company.id, sourceType: 'TEST', sourceId, userId: 'u', reason: 'again' })),
      ).rejects.toBeInstanceOf(BusinessRuleError);
    });

    it('rolls back every movement when a later one in the same transaction fails', async () => {
      const wh = await createWarehouse(ctx.prisma, company, 'RB1');
      const item = await createItem(ctx.prisma, company, 'RB-1');
      await expect(
        ctx.prisma.$transaction((tx) => stock.post(tx, [receipt(wh.id, item.id, 5, 10), issue(wh.id, item.id, 99)])),
      ).rejects.toBeInstanceOf(BusinessRuleError);
      expect(await ctx.prisma.stockLedger.count({ where: { warehouseId: wh.id, itemId: item.id } })).toBe(0);
    });

    it('preserves unit cost through a warehouse transfer', async () => {
      const from = await createWarehouse(ctx.prisma, company, 'TR-FROM');
      const to = await createWarehouse(ctx.prisma, company, 'TR-TO');
      const item = await createItem(ctx.prisma, company, 'TR-1');
      await ctx.prisma.$transaction((tx) => stock.post(tx, [receipt(from.id, item.id, 10, 42.5)]));
      const result = await ctx.prisma.$transaction((tx) =>
        stock.transfer(tx, { companyId: company.id, txnDate: new Date(), fromWarehouseId: from.id, toWarehouseId: to.id, itemId: item.id, qty: 4, sourceType: 'TEST', sourceId: 'tr', userId: 'u' }),
      );
      expect(result.in.unitCost.toString()).toBe('42.5');
      const dest = await ctx.prisma.stockBalance.findFirstOrThrow({ where: { warehouseId: to.id, itemId: item.id } });
      expect(dest.value.equals(new Prisma.Decimal('170'))).toBe(true);
    });
  });
});
