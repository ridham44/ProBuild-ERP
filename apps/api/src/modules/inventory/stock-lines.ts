import type { Item, ItemUnitConversion, Prisma } from '@prisma/client';
import { BusinessRuleError } from '../../common/errors/domain-errors';
import { Db } from '../../prisma/prisma.service';
import { allowedUnits, baseUnitFactor } from './units';

export type ItemWithUnits = Item & { unitConversions: ItemUnitConversion[] };

export type LineIssue = { path: string; message: string };

/** Loads the items a document references, scoped to the company, keyed by id. Missing ids are simply absent. */
export async function loadItems(db: Db, companyId: string, itemIds: string[]): Promise<Map<string, ItemWithUnits>> {
  const items = await db.item.findMany({
    where: { id: { in: [...new Set(itemIds)] }, companyId, deletedAt: null },
    include: { unitConversions: true },
  });
  return new Map(items.map((i) => [i.id, i]));
}

/** The unit a line is entered in: its own, else the item's issue unit, else the base unit. Must be a unit the item defines. */
export function resolveUnit(item: ItemWithUnits, unit: string | undefined, fallback: 'issue' | 'purchase' | 'base' = 'base'): string | null {
  const chosen = unit ?? (fallback === 'issue' ? item.issueUnit : fallback === 'purchase' ? item.purchaseUnit : null) ?? item.baseUnit;
  return allowedUnits(item, item.unitConversions).has(chosen) ? chosen : null;
}

export function factorFor(item: ItemWithUnits, unit: string): Prisma.Decimal {
  return baseUnitFactor(item, item.unitConversions, unit);
}

export function throwIfIssues(message: string, issues: LineIssue[]): void {
  if (issues.length > 0) throw new BusinessRuleError(message, issues);
}

/** Tracking rules that apply to every outbound or adjusting line, independent of the document type. */
export function trackingIssues(item: Item, line: { batchNo?: string | null; serialNo?: string | null }, at: (field: string) => string): LineIssue[] {
  const issues: LineIssue[] = [];
  if (item.trackBatch && !line.batchNo) issues.push({ path: at('batchNo'), message: `${item.sku} is batch-controlled: batch number required` });
  if (!item.trackBatch && line.batchNo) issues.push({ path: at('batchNo'), message: `${item.sku} is not batch-controlled` });
  if (item.trackSerial && !line.serialNo) issues.push({ path: at('serialNo'), message: `${item.sku} is serialized: serial number required` });
  if (!item.trackSerial && line.serialNo) issues.push({ path: at('serialNo'), message: `${item.sku} is not serialized` });
  return issues;
}
