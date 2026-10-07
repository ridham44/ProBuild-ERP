import { describe, expect, it } from 'vitest';
import { safeNextPath } from './safe-redirect';

describe('safeNextPath', () => {
  it('keeps same-origin relative paths including the query', () => {
    expect(safeNextPath('/approvals?status=PENDING')).toBe('/approvals?status=PENDING');
  });

  it('rejects absolute, protocol-relative and backslash URLs', () => {
    expect(safeNextPath('https://evil.example')).toBe('/');
    expect(safeNextPath('//evil.example')).toBe('/');
    expect(safeNextPath('/\\evil.example')).toBe('/');
  });

  it('never redirects back to the sign-in pages', () => {
    expect(safeNextPath('/login?next=/')).toBe('/');
    expect(safeNextPath('/reset-password')).toBe('/');
  });

  it('uses the fallback for missing values', () => {
    expect(safeNextPath(null)).toBe('/');
    expect(safeNextPath(undefined, '/home')).toBe('/home');
  });
});
