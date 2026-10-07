import { describe, expect, it } from 'vitest';
import { manilaDateString, manilaMonthRange, manilaParts, startOfManilaDay } from './time';

describe('Asia/Manila business dates', () => {
  it('treats 00:30 on 1 Jan in Manila as the new year even though UTC is still 31 Dec', () => {
    const instant = new Date('2025-12-31T16:30:00Z');
    expect(manilaParts(instant)).toEqual({ year: 2026, month: 1, day: 1 });
  });

  it('keeps 23:30 Manila time on the same day', () => {
    expect(manilaParts(new Date('2026-03-15T15:30:00Z'))).toEqual({ year: 2026, month: 3, day: 15 });
  });

  it('computes month ranges across a year boundary', () => {
    const { start, endExclusive } = manilaMonthRange(2026, 12);
    expect(start.toISOString()).toBe('2026-11-30T16:00:00.000Z');
    expect(endExclusive.toISOString()).toBe('2026-12-31T16:00:00.000Z');
  });

  it('formats dates in Manila', () => {
    expect(manilaDateString(startOfManilaDay(2026, 2, 1))).toBe('2026-02-01');
  });
});
