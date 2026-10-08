import type { Comparison } from '@/lib/api/types';

export type ComparisonSupplier = Comparison['suppliers'][number];
export type ComparisonLine = Comparison['lines'][number];
export type ComparisonOffer = ComparisonLine['offers'][number];

export type MatrixCell = { supplierId: string; offer: ComparisonOffer | null };
export type MatrixRow = { line: ComparisonLine; cells: MatrixCell[] };

/**
 * Lays offers out as item rows by supplier columns, in the supplier order the API returns. A supplier that
 * did not quote a line gets an explicit empty cell so the matrix stays aligned.
 */
export function buildMatrix(comparison: Comparison): MatrixRow[] {
  return comparison.lines.map((line) => ({
    line,
    cells: comparison.suppliers.map((supplier) => ({
      supplierId: supplier.supplierId,
      offer: line.offers.find((offer) => offer.supplierId === supplier.supplierId) ?? null,
    })),
  }));
}

export type OfferHighlight = 'lowest-price' | 'fastest-delivery' | 'preferred' | 'short-quote';

/** Flags the API computed for an offer, in the order they are shown. */
export function offerHighlights(offer: ComparisonOffer | null): OfferHighlight[] {
  if (!offer) return [];
  return [
    ...(offer.isLowestPrice ? (['lowest-price'] as const) : []),
    ...(offer.isFastestDelivery ? (['fastest-delivery'] as const) : []),
    ...(offer.isPreferredSupplier ? (['preferred'] as const) : []),
    ...(offer.isShortQuote ? (['short-quote'] as const) : []),
  ];
}

export const HIGHLIGHT_LABEL: Record<OfferHighlight, string> = {
  'lowest-price': 'Lowest price',
  'fastest-delivery': 'Fastest delivery',
  preferred: 'Preferred supplier',
  'short-quote': 'Partial quantity',
};

/** "Lowest" for the best offer, otherwise how far above it, e.g. "+4.2%". Null when no comparison exists. */
export function varianceLabel(pct: string | null, isLowest: boolean): string | null {
  if (isLowest) return 'Lowest';
  if (pct === null) return null;
  const value = Number(pct);
  if (!Number.isFinite(value)) return null;
  if (value === 0) return 'Lowest';
  return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;
}

/** Suppliers whose quotation can be awarded: submitted, still valid and not already awarded. */
export function awardable(supplier: ComparisonSupplier): boolean {
  return supplier.status === 'SUBMITTED' && !supplier.isExpired;
}

export function whyNotAwardable(supplier: ComparisonSupplier): string | null {
  if (supplier.status === 'AWARDED') return 'Awarded';
  if (supplier.status === 'NOT_AWARDED') return 'Not awarded';
  if (supplier.isExpired) return 'Quotation expired';
  return null;
}
