import { Prisma } from '@prisma/client';

type ItemUnits = {
  baseUnit: string;
  purchaseUnit: string | null;
  issueUnit: string | null;
  conversionFactor: Prisma.Decimal;
};
type Conversion = { unit: string; factor: Prisma.Decimal };

/** Every unit a document line may use for this item. */
export function allowedUnits(item: ItemUnits, conversions: Conversion[]): Set<string> {
  const units = new Set<string>([item.baseUnit]);
  if (item.purchaseUnit) units.add(item.purchaseUnit);
  if (item.issueUnit) units.add(item.issueUnit);
  for (const c of conversions) units.add(c.unit);
  return units;
}

/**
 * How many base units one `unit` holds. Explicit conversions win; otherwise the item's purchase unit uses
 * its conversionFactor; the base unit (and the issue unit, which is stocked in base units) is 1.
 */
export function baseUnitFactor(item: ItemUnits, conversions: Conversion[], unit: string): Prisma.Decimal {
  if (unit === item.baseUnit) return new Prisma.Decimal(1);
  const explicit = conversions.find((c) => c.unit === unit);
  if (explicit) return explicit.factor;
  if (unit === item.purchaseUnit) return item.conversionFactor;
  return new Prisma.Decimal(1);
}
