import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { BusinessRuleError } from '../../common/errors/domain-errors';
import { allocateFreight, availableToIssue, fromBaseQty, landedUnitCost, pickBatchesFefo, resolveQcSplit, toBaseQty } from './stock-math';

const D = (v: string | number) => new Prisma.Decimal(v);
const day = (iso: string) => new Date(`${iso}T00:00:00Z`);

/** The human-readable reason carried by a BusinessRuleError (HttpException.message is only the generic title). */
function reasonOf(fn: () => unknown): string {
  try {
    fn();
  } catch (error) {
    if (error instanceof BusinessRuleError) return (error.getResponse() as { detail: string }).detail;
    throw error;
  }
  throw new Error('Expected the call to throw');
}

describe('unit conversion', () => {
  it('converts document units to base units and back', () => {
    expect(toBaseQty(D('2.5'), D(12)).toString()).toBe('30');
    expect(fromBaseQty(D(30), D(12)).toString()).toBe('2.5');
  });

  it('keeps four decimals when converting back', () => {
    expect(fromBaseQty(D(1), D(3)).toString()).toBe('0.3333');
  });
});

describe('freight allocation', () => {
  it('splits freight in proportion to line value and always adds up to the freight', () => {
    const shares = allocateFreight([{ id: 'a', net: D(100) }, { id: 'b', net: D(100) }, { id: 'c', net: D(100) }], D(100));
    const total = [...shares.values()].reduce((s, v) => s.plus(v), D(0));
    expect(total.toString()).toBe('100');
    expect([...shares.values()].map((v) => v.toString()).sort()).toEqual(['33.33', '33.33', '33.34']);
  });

  it('gives nothing to a zero-value line and nothing at all when there is no freight', () => {
    expect(allocateFreight([{ id: 'a', net: D(0) }, { id: 'b', net: D(50) }], D(10)).get('a')?.toString()).toBe('0');
    expect(allocateFreight([{ id: 'a', net: D(10) }], D(0)).get('a')?.toString()).toBe('0');
  });
});

describe('landed unit cost', () => {
  it('adds the freight share to the net value and divides by ordered quantity (tax excluded)', () => {
    // 1200 bags, net 309,684 after discount, freight share 1,200 -> 258.07 + 1.00
    const cost = landedUnitCost({ lineNet: D('309684'), freightShare: D('1200'), orderedQty: D(1200), baseFactor: D(1) });
    expect(cost.perOrderUnit.toString()).toBe('259.07');
    expect(cost.perBaseUnit.toString()).toBe('259.07');
  });

  it('prices the base unit when the PO unit holds several', () => {
    // 10 boxes of 12 pcs for 1,200 -> 120 per box, 10 per piece
    const cost = landedUnitCost({ lineNet: D(1200), freightShare: D(0), orderedQty: D(10), baseFactor: D(12) });
    expect(cost.perOrderUnit.toString()).toBe('120');
    expect(cost.perBaseUnit.toString()).toBe('10');
  });

  it('refuses a line with no ordered quantity', () => {
    expect(() => landedUnitCost({ lineNet: D(1), freightShare: D(0), orderedQty: D(0), baseFactor: D(1) })).toThrow(BusinessRuleError);
  });
});

describe('QC split', () => {
  it('PASS accepts everything not rejected at the dock; no inspection behaves the same', () => {
    const split = resolveQcSplit({ received: D(100), dockRejected: D(5), outcome: 'PASS' });
    expect([split.accepted, split.rejected, split.quarantine].map(String)).toEqual(['95', '5', '0']);
    expect(resolveQcSplit({ received: D(100), dockRejected: D(0), outcome: null }).accepted.toString()).toBe('100');
  });

  it('FAIL rejects the whole delivery', () => {
    const split = resolveQcSplit({ received: D(40), dockRejected: D(0), outcome: 'FAIL' });
    expect([split.accepted, split.rejected, split.quarantine].map(String)).toEqual(['0', '40', '0']);
  });

  it('PARTIAL must account for every unit', () => {
    const split = resolveQcSplit({ received: D(100), dockRejected: D(0), outcome: 'PARTIAL', accepted: D(70), rejected: D(10), quarantine: D(20) });
    expect(split.quarantine.toString()).toBe('20');
    expect(reasonOf(() => resolveQcSplit({ received: D(100), dockRejected: D(0), outcome: 'PARTIAL', accepted: D(70), rejected: D(10), quarantine: D(10) }))).toMatch(/add up/);
  });
});

describe('FEFO batch selection', () => {
  const batches = [
    { batchNo: 'LATE', expiryDate: day('2027-06-01'), qty: D(50), receivedAt: day('2026-01-01') },
    { batchNo: 'SOON', expiryDate: day('2026-12-01'), qty: D(30), receivedAt: day('2026-03-01') },
    { batchNo: 'OLD-NOEXP', expiryDate: null, qty: D(40), receivedAt: day('2025-01-01') },
    { batchNo: 'NEW-NOEXP', expiryDate: null, qty: D(40), receivedAt: day('2026-02-01') },
    { batchNo: 'EXPIRED', expiryDate: day('2026-01-01'), qty: D(99), receivedAt: day('2025-06-01') },
  ];
  const now = day('2026-10-08');

  it('takes the soonest expiry first, then un-dated batches oldest first, and skips expired batches', () => {
    const picks = pickBatchesFefo(batches, D(100), now);
    expect(picks.map((p) => [p.batchNo, p.qty.toString()])).toEqual([['SOON', '30'], ['LATE', '50'], ['OLD-NOEXP', '20']]);
  });

  it('draws from a single batch when it is enough', () => {
    expect(pickBatchesFefo(batches, D(10), now).map((p) => p.batchNo)).toEqual(['SOON']);
  });

  it('never issues expired stock, and says so when that is why it falls short', () => {
    expect(reasonOf(() => pickBatchesFefo([batches[4]!], D(1), now, 'SKU-1'))).toMatch(/99 expired and excluded/);
  });

  it('fails with a clear shortfall when usable stock is not enough', () => {
    expect(() => pickBatchesFefo(batches, D(500), now)).toThrow(BusinessRuleError);
  });
});

describe('available to issue', () => {
  it('is on hand minus what other requests reserved', () => {
    expect(availableToIssue(D(100), D(30)).toString()).toBe('70');
  });
});
