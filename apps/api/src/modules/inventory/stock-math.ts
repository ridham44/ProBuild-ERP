import { Prisma } from '@prisma/client';
import { BusinessRuleError } from '../../common/errors/domain-errors';
import { round2 } from '../../common/money';

const D = Prisma.Decimal;

// ---- Unit conversion ----------------------------------------------------------------------------

/** Converts a quantity in a document unit to the item's base unit (factor = base units per document unit). */
export function toBaseQty(qty: Prisma.Decimal, factor: Prisma.Decimal): Prisma.Decimal {
  return qty.mul(factor);
}

/** Converts a base-unit quantity back to a document unit; the result keeps at most 4 decimal places. */
export function fromBaseQty(baseQty: Prisma.Decimal, factor: Prisma.Decimal): Prisma.Decimal {
  return baseQty.div(factor).toDecimalPlaces(4, D.ROUND_HALF_UP);
}

// ---- Receipt cost allocation --------------------------------------------------------------------

export type CostableLine = { id: string; net: Prisma.Decimal };

/**
 * Splits the PO freight over its lines in proportion to each line's net value (after discount, before tax).
 * Each share is rounded to 2 decimals half-up; the rounding residue goes to the largest line so the shares always
 * add up to the freight exactly.
 */
export function allocateFreight(lines: CostableLine[], freight: Prisma.Decimal): Map<string, Prisma.Decimal> {
  const shares = new Map<string, Prisma.Decimal>();
  const total = lines.reduce((sum, l) => sum.plus(l.net), new D(0));
  if (lines.length === 0) return shares;
  if (freight.isZero() || total.isZero()) {
    for (const l of lines) shares.set(l.id, new D(0));
    return shares;
  }
  let allocated = new D(0);
  for (const l of lines) {
    const share = round2(freight.mul(l.net).div(total));
    shares.set(l.id, share);
    allocated = allocated.plus(share);
  }
  const largest = lines.reduce((a, b) => (b.net.gt(a.net) ? b : a));
  shares.set(largest.id, (shares.get(largest.id) ?? new D(0)).plus(freight.minus(allocated)));
  return shares;
}

/**
 * Landed cost of one PO unit and of one base unit:
 *   (line net value after discount + the line's freight share) / ordered qty, rounded to 4 decimals.
 * Tax is excluded: input VAT is recoverable and is not part of inventory value.
 */
export function landedUnitCost(input: {
  lineNet: Prisma.Decimal;
  freightShare: Prisma.Decimal;
  orderedQty: Prisma.Decimal;
  baseFactor: Prisma.Decimal;
}): { perOrderUnit: Prisma.Decimal; perBaseUnit: Prisma.Decimal } {
  if (input.orderedQty.lte(0)) throw new BusinessRuleError('The purchase order line has no ordered quantity to cost');
  const landed = input.lineNet.plus(input.freightShare);
  return {
    perOrderUnit: landed.div(input.orderedQty).toDecimalPlaces(4, D.ROUND_HALF_UP),
    perBaseUnit: landed.div(input.orderedQty.mul(input.baseFactor)).toDecimalPlaces(4, D.ROUND_HALF_UP),
  };
}

// ---- QC split -----------------------------------------------------------------------------------

export type QcSplit = { accepted: Prisma.Decimal; rejected: Prisma.Decimal; quarantine: Prisma.Decimal };

/**
 * Turns an inspection outcome into quantities for a line that was `received` in total with `dockRejected` already
 * refused at the dock. PASS accepts the rest, FAIL rejects everything, PARTIAL must account for every unit.
 */
export function resolveQcSplit(input: {
  received: Prisma.Decimal;
  dockRejected: Prisma.Decimal;
  outcome: 'PASS' | 'FAIL' | 'PARTIAL' | null;
  accepted?: Prisma.Decimal;
  rejected?: Prisma.Decimal;
  quarantine?: Prisma.Decimal;
}): QcSplit {
  const zero = new D(0);
  if (input.outcome === null || input.outcome === 'PASS') {
    return { accepted: input.received.minus(input.dockRejected), rejected: input.dockRejected, quarantine: zero };
  }
  if (input.outcome === 'FAIL') return { accepted: zero, rejected: input.received, quarantine: zero };
  const accepted = input.accepted ?? zero;
  const rejected = input.rejected ?? zero;
  const quarantine = input.quarantine ?? zero;
  if (!accepted.plus(rejected).plus(quarantine).equals(input.received)) {
    throw new BusinessRuleError(
      `Inspection quantities (accepted ${accepted} + rejected ${rejected} + quarantine ${quarantine}) must add up to the ${input.received} received`,
    );
  }
  return { accepted, rejected, quarantine };
}

// ---- Batch selection (FEFO) ---------------------------------------------------------------------

export type BatchCandidate = { batchNo: string; expiryDate: Date | null; qty: Prisma.Decimal; receivedAt: Date };
export type BatchAllocation = { batchNo: string; qty: Prisma.Decimal };

/**
 * First-expired-first-out. Batches that expire sooner go first; batches without an expiry follow, oldest receipt first.
 * Expired batches are never issued. Throws when the usable stock cannot cover `needed`.
 */
export function pickBatchesFefo(candidates: BatchCandidate[], needed: Prisma.Decimal, now: Date, itemLabel = 'item'): BatchAllocation[] {
  const usable = candidates.filter((c) => c.qty.gt(0) && (c.expiryDate === null || c.expiryDate > now));
  usable.sort((a, b) => {
    if (a.expiryDate && b.expiryDate) return a.expiryDate.getTime() - b.expiryDate.getTime() || a.batchNo.localeCompare(b.batchNo);
    if (a.expiryDate) return -1;
    if (b.expiryDate) return 1;
    return a.receivedAt.getTime() - b.receivedAt.getTime() || a.batchNo.localeCompare(b.batchNo);
  });
  const out: BatchAllocation[] = [];
  let remaining = needed;
  for (const batch of usable) {
    if (remaining.lte(0)) break;
    const take = D.min(batch.qty, remaining);
    out.push({ batchNo: batch.batchNo, qty: take });
    remaining = remaining.minus(take);
  }
  if (remaining.gt(0)) {
    const expired = candidates.filter((c) => c.expiryDate !== null && c.expiryDate <= now).reduce((s, c) => s.plus(c.qty), new D(0));
    const usableQty = usable.reduce((s, c) => s.plus(c.qty), new D(0));
    throw new BusinessRuleError(
      `Not enough unexpired stock of ${itemLabel}: need ${needed}, usable ${usableQty}${expired.gt(0) ? ` (${expired} expired and excluded)` : ''}`,
    );
  }
  return out;
}

/** Stock a document may consume: on hand minus what other approved requests have reserved. */
export function availableToIssue(onHand: Prisma.Decimal, reservedByOthers: Prisma.Decimal): Prisma.Decimal {
  return onHand.minus(reservedByOthers);
}
