import { manilaParts } from '@probuild/shared';

const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;
const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;
const DECIMAL = /^-?\d+(\.\d+)?$/;

export const EMPTY_VALUE = '—';

type Numeric = `${number}`;

function isNumericString(value: string): value is Numeric {
  return DECIMAL.test(value.trim());
}

/** Decimal strings from the API are passed to Intl untouched so no float rounding is introduced. */
function toFormattable(value: string | number | null | undefined): number | Numeric | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const trimmed = value.trim();
  return isNumericString(trimmed) ? trimmed : null;
}

const phpFormatter = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const phpAccountingFormatter = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  currencySign: 'accounting',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const numberFormatter = new Intl.NumberFormat('en-PH', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export type FormatPhpOptions = { accounting?: boolean; symbol?: boolean };

/** Philippine peso. Always two decimals; `accounting` shows negatives in parentheses. */
export function formatPHP(
  value: string | number | null | undefined,
  options: FormatPhpOptions = {},
): string {
  const formattable = toFormattable(value);
  if (formattable === null) return EMPTY_VALUE;
  if (options.symbol === false) return numberFormatter.format(formattable);
  return (options.accounting ? phpAccountingFormatter : phpFormatter).format(formattable);
}

/** Quantity with up to `maxFraction` decimals and no trailing zeros, optionally followed by a unit. */
export function formatQty(
  value: string | number | null | undefined,
  unit?: string,
  maxFraction = 4,
): string {
  const formattable = toFormattable(value);
  if (formattable === null) return EMPTY_VALUE;
  const text = new Intl.NumberFormat('en-PH', {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxFraction,
  }).format(formattable);
  return unit ? `${text} ${unit}` : text;
}

function toDate(value: string | Date | null | undefined): Date | null {
  if (value === null || value === undefined || value === '') return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** DD MMM YYYY on the Asia/Manila calendar, independent of the viewer's time zone. */
export function formatDate(value: string | Date | null | undefined): string {
  const date = toDate(value);
  if (!date) return EMPTY_VALUE;
  const { year, month, day } = manilaParts(date);
  return `${String(day).padStart(2, '0')} ${MONTHS[month - 1]} ${year}`;
}

/** DD MMM YYYY, h:mm AM/PM on the Asia/Manila clock. */
export function formatDateTime(value: string | Date | null | undefined): string {
  const date = toDate(value);
  if (!date) return EMPTY_VALUE;
  const shifted = new Date(date.getTime() + MANILA_OFFSET_MS);
  const hours24 = shifted.getUTCHours();
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  const minutes = String(shifted.getUTCMinutes()).padStart(2, '0');
  const meridiem = hours24 < 12 ? 'AM' : 'PM';
  return `${formatDate(date)}, ${hours12}:${minutes} ${meridiem}`;
}

const relativeFormatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
const RELATIVE_STEPS: Array<{ unit: Intl.RelativeTimeFormatUnit; ms: number }> = [
  { unit: 'day', ms: 86_400_000 },
  { unit: 'hour', ms: 3_600_000 },
  { unit: 'minute', ms: 60_000 },
];

/** "5 minutes ago", "yesterday"; falls back to the absolute date after a week. */
export function formatRelative(
  value: string | Date | null | undefined,
  now: Date = new Date(),
): string {
  const date = toDate(value);
  if (!date) return EMPTY_VALUE;
  const diff = date.getTime() - now.getTime();
  if (Math.abs(diff) >= 7 * 86_400_000) return formatDate(date);
  for (const { unit, ms } of RELATIVE_STEPS) {
    if (Math.abs(diff) >= ms) return relativeFormatter.format(Math.round(diff / ms), unit);
  }
  return 'just now';
}

/** Today's Manila calendar date as YYYY-MM-DD, for date inputs. */
export function manilaToday(now: Date = new Date()): string {
  const { year, month, day } = manilaParts(now);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** "Draft" from "DRAFT", "Pending Approval" from "PENDING_APPROVAL". */
export function titleCase(value: string): string {
  return value
    .toLowerCase()
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
