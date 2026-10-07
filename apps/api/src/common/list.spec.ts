import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { buildOrderBy, containsAny, dateRange } from './list';

describe('buildOrderBy', () => {
  const allowed = ['code', 'name'] as const;

  it('falls back to the default order and always ends with id', () => {
    expect(buildOrderBy(undefined, allowed, [{ code: 'asc' }])).toEqual([{ code: 'asc' }, { id: 'asc' }]);
  });

  it('accepts whitelisted fields with a direction', () => {
    expect(buildOrderBy('name:desc', allowed, [{ code: 'asc' }])).toEqual([{ name: 'desc' }, { id: 'asc' }]);
  });

  it('rejects fields that are not whitelisted', () => {
    expect(() => buildOrderBy('passwordHash:asc', allowed, [{ code: 'asc' }])).toThrow(BadRequestException);
  });
});

describe('filters', () => {
  it('builds a case-insensitive OR across columns, or nothing without a search', () => {
    expect(containsAny(undefined, ['a'])).toEqual({});
    expect(containsAny('abc', ['a', 'b'])).toEqual({
      OR: [{ a: { contains: 'abc', mode: 'insensitive' } }, { b: { contains: 'abc', mode: 'insensitive' } }],
    });
  });

  it('builds an inclusive date range only when a bound is given', () => {
    const from = new Date('2026-01-01');
    expect(dateRange()).toBeUndefined();
    expect(dateRange(from)).toEqual({ gte: from });
  });
});
