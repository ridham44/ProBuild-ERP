import { describe, expect, it } from 'vitest';
import { createItemSchema, updateItemSchema } from './inventory';
import { updateWarehouseSchema } from './organization';
import { createPurchaseOrderSchema, createRequisitionSchema, createRfqSchema } from './procurement';
import { PROJECT_TRANSITIONS, updateProjectSchema } from './project';

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const baseItem = { sku: 'CEM-40', name: 'Cement', baseUnit: 'bag' };

describe('item costing method', () => {
  it.each(['FIFO', 'MOVING_AVERAGE'])('rejects %s', (method) => {
    const res = createItemSchema.safeParse({ ...baseItem, costingMethod: method });
    expect(res.success).toBe(false);
    expect(JSON.stringify(res.error?.issues)).toContain('WEIGHTED_AVERAGE or STANDARD');
  });

  it('accepts weighted average and standard (with a standard cost)', () => {
    expect(createItemSchema.safeParse({ ...baseItem, costingMethod: 'WEIGHTED_AVERAGE' }).success).toBe(true);
    expect(createItemSchema.safeParse({ ...baseItem, costingMethod: 'STANDARD', standardCost: '250' }).success).toBe(true);
    expect(createItemSchema.safeParse({ ...baseItem, costingMethod: 'STANDARD' }).success).toBe(false);
  });

  it('checks min/max and expiry-needs-batch rules', () => {
    expect(createItemSchema.safeParse({ ...baseItem, minStock: '10', maxStock: '5' }).success).toBe(false);
    expect(createItemSchema.safeParse({ ...baseItem, trackExpiry: true }).success).toBe(false);
    expect(createItemSchema.safeParse({ ...baseItem, trackExpiry: true, trackBatch: true }).success).toBe(true);
  });
});

describe('update schemas never inject defaults', () => {
  it('an item PATCH keeps omitted fields undefined', () => {
    expect(updateItemSchema.parse({ name: 'Renamed' })).toEqual({ name: 'Renamed' });
  });

  it('a warehouse PATCH does not reset its type', () => {
    expect(updateWarehouseSchema.parse({ name: 'Renamed' })).toEqual({ name: 'Renamed' });
  });

  it('a project PATCH keeps omitted fields undefined', () => {
    expect(updateProjectSchema.parse({ name: 'Renamed' })).toEqual({ name: 'Renamed' });
  });
});

describe('quantities and money travel as decimal strings', () => {
  const line = { itemId: uuid(1), qty: '2.5' };

  it('accepts 4dp quantities and rejects zero, negatives and 5dp', () => {
    expect(createRequisitionSchema.safeParse({ projectId: uuid(2), lines: [{ ...line, qty: '0.0001' }] }).success).toBe(true);
    for (const qty of ['0', '-1', '1.00001', 'abc']) {
      expect(createRequisitionSchema.safeParse({ projectId: uuid(2), lines: [{ ...line, qty }] }).success).toBe(false);
    }
  });

  it('requires at least one line', () => {
    expect(createRequisitionSchema.safeParse({ projectId: uuid(2), lines: [] }).success).toBe(false);
  });

  it('rejects duplicate suppliers and duplicate lines on an RFQ', () => {
    const base = { requisitionId: uuid(3), dueDate: '2026-12-01', lines: [{ requisitionLineId: uuid(4) }] };
    expect(createRfqSchema.safeParse({ ...base, supplierIds: [uuid(5), uuid(5)] }).success).toBe(false);
    const dupLines = [{ requisitionLineId: uuid(4) }, { requisitionLineId: uuid(4) }];
    expect(createRfqSchema.safeParse({ ...base, supplierIds: [uuid(5)], lines: dupLines }).success).toBe(false);
    expect(createRfqSchema.safeParse({ ...base, supplierIds: [uuid(5), uuid(6)] }).success).toBe(true);
  });

  it('keeps the PO source fields consistent', () => {
    expect(createPurchaseOrderSchema.safeParse({ source: 'QUOTATION' }).success).toBe(false);
    expect(createPurchaseOrderSchema.safeParse({ source: 'QUOTATION', quotationId: uuid(7) }).success).toBe(true);
    expect(createPurchaseOrderSchema.safeParse({ source: 'REQUISITION', requisitionId: uuid(8), supplierId: uuid(9) }).success).toBe(false);
    const ok = {
      source: 'REQUISITION',
      requisitionId: uuid(8),
      supplierId: uuid(9),
      lines: [{ requisitionLineId: uuid(10), qty: '5', unitPrice: '100.25' }],
    };
    expect(createPurchaseOrderSchema.safeParse(ok).success).toBe(true);
  });
});

describe('project status transitions', () => {
  it('only moves forward along the lifecycle and ends in CLOSED or CANCELLED', () => {
    expect(PROJECT_TRANSITIONS.PIPELINE).toEqual(['ACTIVE', 'CANCELLED']);
    expect(PROJECT_TRANSITIONS.CLOSED).toEqual([]);
    expect(PROJECT_TRANSITIONS.CANCELLED).toEqual([]);
    expect(PROJECT_TRANSITIONS.ACTIVE).not.toContain('CLOSED');
    expect(PROJECT_TRANSITIONS.COMPLETED).toContain('CLOSED');
  });
});
