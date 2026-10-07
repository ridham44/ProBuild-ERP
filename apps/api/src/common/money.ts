import { Prisma } from '@prisma/client';

/**
 * Money and quantity math for purchasing documents. Everything is Prisma.Decimal (decimal.js): no
 * float ever touches a monetary value.
 *
 * Rounding policy (one place, documented):
 *   - Monetary amounts are rounded to 2 decimal places, ROUND_HALF_UP (0.005 -> 0.01), at the LINE level.
 *   - Tax is computed per line on the discounted (net) line amount, then rounded; document tax is the
 *     sum of the already-rounded line taxes, so the document always equals the sum of its lines.
 *   - Unit prices and quantities are never rounded here; they are validated to 4 decimal places on input.
 *   - Percentages are stored with up to 4 decimal places and applied as pct / 100.
 */
const D = Prisma.Decimal;
export type Decimalish = Prisma.Decimal | string | number;

export const ZERO = new D(0);

export function dec(value: Decimalish | null | undefined): Prisma.Decimal {
  return new D(value ?? 0);
}

export function round2(value: Decimalish): Prisma.Decimal {
  return new D(value).toDecimalPlaces(2, D.ROUND_HALF_UP);
}

export type LineMoneyInput = { qty: Decimalish; unitPrice: Decimalish; discountPct?: Decimalish; taxPct?: Decimalish };
export type LineMoney = {
  /** qty x unitPrice, rounded to 2dp. */
  gross: Prisma.Decimal;
  /** gross x discountPct, rounded to 2dp. */
  discount: Prisma.Decimal;
  /** gross - discount; the taxable base. */
  net: Prisma.Decimal;
  /** net x taxPct, rounded to 2dp. */
  tax: Prisma.Decimal;
  /** net + tax. */
  total: Prisma.Decimal;
};

export function computeLine(input: LineMoneyInput): LineMoney {
  const gross = round2(dec(input.qty).mul(dec(input.unitPrice)));
  const discount = round2(gross.mul(dec(input.discountPct)).div(100));
  const net = gross.minus(discount);
  const tax = round2(net.mul(dec(input.taxPct)).div(100));
  return { gross, discount, net, tax, total: net.plus(tax) };
}

export type DocumentMoney = {
  subtotal: Prisma.Decimal;
  discount: Prisma.Decimal;
  net: Prisma.Decimal;
  tax: Prisma.Decimal;
  freight: Prisma.Decimal;
  /** subtotal - discount + tax + freight. */
  total: Prisma.Decimal;
};

export function sumLines(lines: LineMoney[], freight: Decimalish = 0): DocumentMoney {
  const subtotal = lines.reduce((s, l) => s.plus(l.gross), ZERO);
  const discount = lines.reduce((s, l) => s.plus(l.discount), ZERO);
  const tax = lines.reduce((s, l) => s.plus(l.tax), ZERO);
  const shipping = round2(freight);
  const net = subtotal.minus(discount);
  return { subtotal, discount, net, tax, freight: shipping, total: net.plus(tax).plus(shipping) };
}

/** Price difference against a baseline as a percentage (2dp). Null when the baseline is zero. */
export function variancePct(value: Decimalish, baseline: Decimalish): Prisma.Decimal | null {
  const base = new D(baseline);
  if (base.isZero()) return null;
  return new D(value).minus(base).div(base).mul(100).toDecimalPlaces(2, D.ROUND_HALF_UP);
}

/** Never returns less than zero; used for "remaining" quantities. */
export function nonNegative(value: Decimalish): Prisma.Decimal {
  return D.max(new D(value), 0);
}

export type EstimateTotals = {
  directCost: Prisma.Decimal;
  overhead: Prisma.Decimal;
  profit: Prisma.Decimal;
  tax: Prisma.Decimal;
  total: Prisma.Decimal;
};

/**
 * Estimate roll-up: overhead and profit are each a percentage of direct cost; tax applies to
 * (direct + overhead + profit). Every component is rounded to 2dp half-up before it is added.
 */
export function estimateTotals(
  boqAmounts: Decimalish[],
  pct: { overheadPct: Decimalish; profitPct: Decimalish; taxPct: Decimalish },
): EstimateTotals {
  const directCost = boqAmounts.reduce<Prisma.Decimal>((s, a) => s.plus(round2(a)), ZERO);
  const overhead = round2(directCost.mul(dec(pct.overheadPct)).div(100));
  const profit = round2(directCost.mul(dec(pct.profitPct)).div(100));
  const subtotal = directCost.plus(overhead).plus(profit);
  const tax = round2(subtotal.mul(dec(pct.taxPct)).div(100));
  return { directCost, overhead, profit, tax, total: subtotal.plus(tax) };
}
