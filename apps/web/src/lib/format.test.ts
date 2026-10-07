import { describe, expect, it } from 'vitest';
import {
  formatDate,
  formatDateTime,
  formatPHP,
  formatQty,
  formatRelative,
  manilaToday,
  titleCase,
} from './format';

describe('formatPHP', () => {
  it('formats decimal strings with grouping and two decimals', () => {
    expect(formatPHP('1234567.5')).toBe('₱1,234,567.50');
    expect(formatPHP(0)).toBe('₱0.00');
  });

  it('keeps precision of large decimal strings instead of rounding through a float', () => {
    expect(formatPHP('9007199254740993.10')).toBe('₱9,007,199,254,740,993.10');
  });

  it('shows negatives, optionally in accounting style', () => {
    expect(formatPHP('-1500')).toBe('-₱1,500.00');
    expect(formatPHP('-1500', { accounting: true })).toBe('(₱1,500.00)');
  });

  it('can omit the symbol and falls back to a dash for empty or invalid input', () => {
    expect(formatPHP('2500', { symbol: false })).toBe('2,500.00');
    expect(formatPHP(null)).toBe('—');
    expect(formatPHP('')).toBe('—');
    expect(formatPHP('abc')).toBe('—');
  });
});

describe('formatQty', () => {
  it('trims trailing zeros and appends the unit', () => {
    expect(formatQty('12.5000')).toBe('12.5');
    expect(formatQty('1250', 'bags')).toBe('1,250 bags');
    expect(formatQty(undefined)).toBe('—');
  });

  it('limits the number of decimals', () => {
    expect(formatQty('0.123456')).toBe('0.1235');
    expect(formatQty('0.123456', undefined, 2)).toBe('0.12');
  });
});

describe('Asia/Manila dates', () => {
  it('uses the Manila calendar day, not UTC', () => {
    expect(formatDate('2026-10-07T16:30:00Z')).toBe('08 Oct 2026');
    expect(formatDate('2026-10-07T15:59:00Z')).toBe('07 Oct 2026');
  });

  it('formats date and time on the Manila clock with a 12-hour clock', () => {
    expect(formatDateTime('2026-10-07T04:05:00Z')).toBe('07 Oct 2026, 12:05 PM');
    expect(formatDateTime('2026-01-02T16:00:00Z')).toBe('03 Jan 2026, 12:00 AM');
  });

  it('abbreviates September consistently', () => {
    expect(formatDate('2026-09-15T00:00:00Z')).toBe('15 Sep 2026');
  });

  it('returns a dash for missing or invalid dates', () => {
    expect(formatDate(null)).toBe('—');
    expect(formatDateTime('not a date')).toBe('—');
  });

  it('returns today as YYYY-MM-DD in Manila', () => {
    expect(manilaToday(new Date('2026-12-31T17:00:00Z'))).toBe('2027-01-01');
  });
});

describe('formatRelative', () => {
  const now = new Date('2026-10-07T12:00:00Z');

  it('describes recent times in words', () => {
    expect(formatRelative('2026-10-07T11:55:00Z', now)).toBe('5 minutes ago');
    expect(formatRelative('2026-10-07T09:00:00Z', now)).toBe('3 hours ago');
    expect(formatRelative('2026-10-06T12:00:00Z', now)).toBe('yesterday');
    expect(formatRelative('2026-10-07T11:59:50Z', now)).toBe('just now');
  });

  it('falls back to the absolute date after a week', () => {
    expect(formatRelative('2026-09-20T00:00:00Z', now)).toBe('20 Sep 2026');
  });
});

describe('titleCase', () => {
  it('converts enum values to readable labels', () => {
    expect(titleCase('PENDING_APPROVAL')).toBe('Pending Approval');
  });
});
