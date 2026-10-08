/**
 * Exact decimal arithmetic on API decimal strings, for totals shown before the server computes them.
 * Values are held as BigInt scaled by 10^SCALE so no float rounding enters money or quantities.
 */
const SCALE = 6;
const FACTOR = 10n ** BigInt(SCALE);
const PATTERN = /^-?\d+(\.\d+)?$/;

export function isDecimal(value: string): boolean {
  return PATTERN.test(value.trim());
}

/** Parses a decimal string; anything that is not a plain decimal counts as zero. */
export function toScaled(value: string | number | null | undefined): bigint {
  const text = String(value ?? '').trim();
  if (!PATTERN.test(text)) return 0n;
  const negative = text.startsWith('-');
  const [whole = '0', fraction = ''] = text.replace('-', '').split('.');
  const padded = `${fraction}${'0'.repeat(SCALE)}`.slice(0, SCALE);
  const scaled = BigInt(whole) * FACTOR + BigInt(padded);
  return negative ? -scaled : scaled;
}

/** Formats a scaled value with the requested decimals (rounded half away from zero). */
export function fromScaled(value: bigint, decimals = 2): string {
  const negative = value < 0n;
  let magnitude = negative ? -value : value;
  const drop = 10n ** BigInt(SCALE - decimals);
  magnitude = (magnitude + drop / 2n) / drop;
  const unit = 10n ** BigInt(decimals);
  const whole = magnitude / unit;
  const fraction = (magnitude % unit).toString().padStart(decimals, '0');
  const text = decimals > 0 ? `${whole}.${fraction}` : `${whole}`;
  return negative && magnitude !== 0n ? `-${text}` : text;
}

export function addDecimal(a: string | number, b: string | number, decimals = 2): string {
  return fromScaled(toScaled(a) + toScaled(b), decimals);
}

export function subDecimal(a: string | number, b: string | number, decimals = 2): string {
  return fromScaled(toScaled(a) - toScaled(b), decimals);
}

/** quantity x unit price (or any product), rounded to `decimals`. */
export function mulDecimal(a: string | number, b: string | number, decimals = 2): string {
  const product = (toScaled(a) * toScaled(b)) / FACTOR;
  return fromScaled(product, decimals);
}

export function sumDecimal(values: Array<string | number>, decimals = 2): string {
  return fromScaled(
    values.reduce<bigint>((total, value) => total + toScaled(value), 0n),
    decimals,
  );
}

export function compareDecimal(a: string | number, b: string | number): number {
  const left = toScaled(a);
  const right = toScaled(b);
  return left < right ? -1 : left > right ? 1 : 0;
}

/** `pct` percent of `amount` (for example 12 percent VAT on a subtotal), rounded to `decimals`. */
export function pctDecimal(amount: string | number, pct: string | number, decimals = 2): string {
  return fromScaled((toScaled(amount) * toScaled(pct)) / (100n * FACTOR), decimals);
}

export type LineMoney = { gross: string; discount: string; net: string; tax: string; total: string };

/**
 * Same rounding policy as the API: gross, discount and tax are each rounded to 2 decimals per line
 * (half up), tax is on the discounted amount, and a document is the sum of its rounded lines.
 */
export function computeLineMoney(input: {
  qty: string | number;
  unitPrice: string | number;
  discountPct?: string | number;
  taxPct?: string | number;
}): LineMoney {
  const gross = mulDecimal(input.qty, input.unitPrice);
  const discount = pctDecimal(gross, input.discountPct ?? 0);
  const net = subDecimal(gross, discount);
  const tax = pctDecimal(net, input.taxPct ?? 0);
  return { gross, discount, net, tax, total: addDecimal(net, tax) };
}
