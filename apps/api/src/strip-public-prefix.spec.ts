import { describe, expect, it } from 'vitest';
import { stripPublicPrefix } from './strip-public-prefix';

describe('stripPublicPrefix', () => {
  it('removes /api from public paths and keeps the query string', () => {
    expect(stripPublicPrefix('/api/v1/auth/login')).toBe('/v1/auth/login');
    expect(stripPublicPrefix('/api/v1/items?limit=20')).toBe('/v1/items?limit=20');
    expect(stripPublicPrefix('/api/health')).toBe('/health');
    expect(stripPublicPrefix('/api')).toBe('/');
    expect(stripPublicPrefix('/api?x=1')).toBe('/?x=1');
  });

  it('leaves internal calls and look-alike paths untouched', () => {
    expect(stripPublicPrefix('/v1/items')).toBe('/v1/items');
    expect(stripPublicPrefix('/health')).toBe('/health');
    expect(stripPublicPrefix('/apiary/v1')).toBe('/apiary/v1');
    expect(stripPublicPrefix(undefined)).toBeUndefined();
  });
});
