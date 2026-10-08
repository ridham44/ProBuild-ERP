import { describe, expect, it } from 'vitest';
import type { Comparison } from '@/lib/api/types';
import {
  awardable,
  buildMatrix,
  offerHighlights,
  varianceLabel,
  whyNotAwardable,
  type ComparisonOffer,
} from './comparison-model';

function offer(overrides: Partial<ComparisonOffer> & { supplierId: string }): ComparisonOffer {
  return {
    quotationId: `q-${overrides.supplierId}`,
    qty: '100',
    unitPrice: '250',
    discountPct: '0',
    taxPct: '12',
    netUnitPrice: '250',
    lineTotal: '25000',
    taxAmount: '3000',
    deliveryDate: null,
    brand: null,
    specification: null,
    isLowestPrice: false,
    isFastestDelivery: false,
    isPreferredSupplier: false,
    isShortQuote: false,
    varianceFromLowestPct: null,
    varianceFromLowestAmount: null,
    ...overrides,
  };
}

const supplier = (id: string, overrides: Partial<Comparison['suppliers'][number]> = {}): Comparison['suppliers'][number] => ({
  supplierId: id,
  code: id.toUpperCase(),
  name: `Supplier ${id}`,
  quotationId: `q-${id}`,
  quoteNo: null,
  quoteDate: '2026-10-01T00:00:00Z',
  validUntil: null,
  isExpired: false,
  deliveryDays: 7,
  paymentTerms: null,
  currency: 'PHP',
  subtotal: '25000',
  discountAmount: '0',
  freight: '0',
  taxAmount: '3000',
  totalAmount: '28000',
  quotedLines: 2,
  coversAllLines: true,
  isLowestTotal: false,
  varianceFromLowestTotalPct: null,
  status: 'SUBMITTED',
  ...overrides,
});

const comparison: Comparison = {
  rfqId: 'r1',
  number: 'RFQ-1',
  status: 'QUOTED',
  awardedQuotationId: null,
  suppliers: [supplier('a'), supplier('b'), supplier('c')],
  lines: [
    {
      rfqLineId: 'l1',
      lineNo: 1,
      item: { id: 'i1', sku: 'CEM-40', name: 'Portland cement 40kg' },
      description: null,
      qty: '100',
      unit: 'bag',
      requiredDate: null,
      lowestNetUnitPrice: '240',
      fastestDeliveryDate: null,
      offers: [
        offer({ supplierId: 'a', netUnitPrice: '250', varianceFromLowestPct: '4.1667' }),
        offer({ supplierId: 'c', netUnitPrice: '240', isLowestPrice: true, isFastestDelivery: true, isPreferredSupplier: true, varianceFromLowestPct: '0' }),
      ],
    },
  ],
};

describe('buildMatrix', () => {
  it('aligns offers to supplier columns and leaves an empty cell where a supplier did not quote', () => {
    const [row] = buildMatrix(comparison);
    expect(row?.cells.map((cell) => cell.supplierId)).toEqual(['a', 'b', 'c']);
    expect(row?.cells[0]?.offer?.netUnitPrice).toBe('250');
    expect(row?.cells[1]?.offer).toBeNull();
    expect(row?.cells[2]?.offer?.netUnitPrice).toBe('240');
  });
});

describe('offerHighlights', () => {
  it('lists every flag the API set, lowest price first', () => {
    const best = comparison.lines[0]?.offers[1] ?? null;
    expect(offerHighlights(best)).toEqual(['lowest-price', 'fastest-delivery', 'preferred']);
  });

  it('is empty for an unremarkable offer and for a missing one', () => {
    expect(offerHighlights(comparison.lines[0]?.offers[0] ?? null)).toEqual([]);
    expect(offerHighlights(null)).toEqual([]);
  });

  it('marks a partial-quantity quote', () => {
    expect(offerHighlights(offer({ supplierId: 'z', isShortQuote: true }))).toEqual(['short-quote']);
  });

  it('highlights every supplier in a tie for the lowest price', () => {
    const tied = [offer({ supplierId: 'a', isLowestPrice: true }), offer({ supplierId: 'b', isLowestPrice: true })];
    expect(tied.map((entry) => offerHighlights(entry).includes('lowest-price'))).toEqual([true, true]);
  });
});

describe('varianceLabel', () => {
  it('says Lowest for the best offer', () => {
    expect(varianceLabel('0', true)).toBe('Lowest');
    expect(varianceLabel(null, true)).toBe('Lowest');
  });

  it('shows a signed percentage above the lowest', () => {
    expect(varianceLabel('4.1667', false)).toBe('+4.2%');
  });

  it('shows nothing when there is nothing to compare against', () => {
    expect(varianceLabel(null, false)).toBeNull();
  });
});

describe('awardable', () => {
  it('only offers award on submitted, unexpired quotations', () => {
    expect(awardable(supplier('a'))).toBe(true);
    expect(awardable(supplier('a', { isExpired: true }))).toBe(false);
    expect(awardable(supplier('a', { status: 'AWARDED' }))).toBe(false);
    expect(awardable(supplier('a', { status: 'NOT_AWARDED' }))).toBe(false);
  });

  it('explains why not', () => {
    expect(whyNotAwardable(supplier('a', { isExpired: true }))).toBe('Quotation expired');
    expect(whyNotAwardable(supplier('a', { status: 'AWARDED' }))).toBe('Awarded');
    expect(whyNotAwardable(supplier('a'))).toBeNull();
  });
});
