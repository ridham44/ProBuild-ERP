import { describe, expect, it } from 'vitest';
import { cappedCount, formatCappedCount, greeting, todayLabel } from './model';

describe('dashboard counts', () => {
  it('marks a count as capped when the list has another page', () => {
    expect(formatCappedCount(cappedCount({ items: [1, 2, 3], nextCursor: null }))).toBe('3');
    expect(formatCappedCount(cappedCount({ items: [1, 2], nextCursor: 'abc' }))).toBe('2+');
    expect(formatCappedCount(cappedCount(undefined))).toBe('');
  });
});

describe('greeting and date', () => {
  it('greets by the Manila clock, not UTC', () => {
    // 23:30 UTC is 07:30 the next morning in Manila.
    expect(greeting(new Date('2026-10-08T23:30:00Z'))).toBe('Good morning');
    expect(greeting(new Date('2026-10-09T06:00:00Z'))).toBe('Good afternoon');
    expect(greeting(new Date('2026-10-09T12:00:00Z'))).toBe('Good evening');
  });

  it('labels today on the Manila calendar', () => {
    expect(todayLabel(new Date('2026-10-08T23:30:00Z'))).toBe('Friday, 09 Oct 2026');
  });
});
