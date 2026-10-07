import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { allowedUnits, baseUnitFactor } from './units';

const item = { baseUnit: 'pc', purchaseUnit: 'box', issueUnit: 'pc', conversionFactor: new Prisma.Decimal(12) };
const conversions = [{ unit: 'pallet', factor: new Prisma.Decimal(480) }];

describe('item units', () => {
  it('allows base, purchase, issue and explicit conversion units only', () => {
    const units = allowedUnits(item, conversions);
    expect([...units].sort()).toEqual(['box', 'pallet', 'pc']);
    expect(units.has('kg')).toBe(false);
  });

  it('converts to base units: explicit conversion first, then the purchase unit factor', () => {
    expect(baseUnitFactor(item, conversions, 'pc').toString()).toBe('1');
    expect(baseUnitFactor(item, conversions, 'pallet').toString()).toBe('480');
    expect(baseUnitFactor(item, conversions, 'box').toString()).toBe('12');
  });

  it('lets an explicit conversion override the legacy purchase-unit factor', () => {
    const override = [{ unit: 'box', factor: new Prisma.Decimal(10) }];
    expect(baseUnitFactor(item, override, 'box').toString()).toBe('10');
  });
});
