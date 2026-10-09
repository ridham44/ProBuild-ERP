import { describe, expect, it } from 'vitest';
import { movementReferenceHref } from './model';

describe('movementReferenceHref', () => {
  it('links documents that have a screen', () => {
    expect(movementReferenceHref('GOODS_RECEIPT', 'g1')).toBe('/inventory/receipts/g1');
    expect(movementReferenceHref('MATERIAL_ISSUE', 'm1')).toBe('/inventory/material-issues/m1');
  });

  it('returns null for documents without a screen', () => {
    expect(movementReferenceHref('WAREHOUSE_TRANSFER', 't1')).toBeNull();
  });
});
