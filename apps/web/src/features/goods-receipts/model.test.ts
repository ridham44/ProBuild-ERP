import { describe, expect, it } from 'vitest';
import {
  availableGrnActions,
  blankInspection,
  buildInspectionBody,
  qcOutcomeCounts,
  splitSerials,
  type ReceiptLineDraft,
  validateInspection,
  validateReceiptLine,
} from './model';

const all = { post: true, cancel: true, inspect: true };

describe('availableGrnActions', () => {
  it('offers post, cancel and QC on a draft', () => {
    expect(availableGrnActions('DRAFT', all)).toEqual({ post: true, cancel: true, inspect: true, decideQuarantine: false });
  });

  it('offers reversal and quarantine decisions on a posted receipt', () => {
    expect(availableGrnActions('POSTED', all)).toEqual({ post: false, cancel: true, inspect: false, decideQuarantine: true });
  });

  it('offers nothing on a cancelled receipt or without permission', () => {
    expect(availableGrnActions('CANCELLED', all)).toEqual({ post: false, cancel: false, inspect: false, decideQuarantine: false });
    expect(availableGrnActions('DRAFT', { post: false, cancel: false, inspect: false }).post).toBe(false);
  });
});

describe('inspection validation', () => {
  it('accepts a pass without quantities or a reason', () => {
    expect(validateInspection(blankInspection(), '10')).toEqual({});
    expect(buildInspectionBody(blankInspection())).toEqual({ outcome: 'PASS' });
  });

  it('requires a reason when failing', () => {
    expect(validateInspection({ ...blankInspection(), outcome: 'FAIL' }, '10').reason).toBeDefined();
    expect(validateInspection({ ...blankInspection(), outcome: 'FAIL', reason: 'Cracked' }, '10')).toEqual({});
  });

  it('requires a partial split to add up to the quantity under inspection', () => {
    const partial = { ...blankInspection(), outcome: 'PARTIAL' as const, acceptedQty: '6', rejectedQty: '2', quarantineQty: '1', reason: 'Damaged' };
    expect(validateInspection(partial, '10').acceptedQty).toBeDefined();
    expect(validateInspection({ ...partial, quarantineQty: '2' }, '10')).toEqual({});
  });

  it('sends quantities only for a partial inspection', () => {
    const body = buildInspectionBody({ ...blankInspection(), outcome: 'PARTIAL', acceptedQty: '6', rejectedQty: '2', quarantineQty: '2', reason: 'Damaged' });
    expect(body).toEqual({ outcome: 'PARTIAL', acceptedQty: '6', rejectedQty: '2', quarantineQty: '2', reason: 'Damaged' });
  });
});

describe('receipt line validation', () => {
  const draft: ReceiptLineDraft = { orderLineId: 'l1', receivedQty: '5', rejectedQty: '', rejectionReason: '', batchNo: '', expiryDate: '', serials: '' };
  const plain = { trackBatch: false, trackExpiry: false, trackSerial: false };

  it('accepts a plain line and rejects a quantity of zero', () => {
    expect(validateReceiptLine(draft, plain)).toEqual({});
    expect(validateReceiptLine({ ...draft, receivedQty: '0' }, plain).receivedQty).toBeDefined();
  });

  it('does not allow dock rejections above the delivered quantity', () => {
    expect(validateReceiptLine({ ...draft, rejectedQty: '6' }, plain).rejectedQty).toBeDefined();
  });

  it('requires batch and expiry for tracked items', () => {
    const errors = validateReceiptLine(draft, { trackBatch: true, trackExpiry: true, trackSerial: false });
    expect(errors.batchNo).toBeDefined();
    expect(errors.expiryDate).toBeDefined();
  });

  it('requires one unique serial per unit for serialized items', () => {
    const rules = { trackBatch: false, trackExpiry: false, trackSerial: true };
    expect(validateReceiptLine({ ...draft, receivedQty: '2', serials: 'A1' }, rules).serials).toBeDefined();
    expect(validateReceiptLine({ ...draft, receivedQty: '2', serials: 'A1\nA1' }, rules).serials).toBeDefined();
    expect(validateReceiptLine({ ...draft, receivedQty: '2', serials: 'A1, A2' }, rules)).toEqual({});
    expect(splitSerials('A1, A2\n A3 ')).toEqual(['A1', 'A2', 'A3']);
  });
});

describe('qcOutcomeCounts', () => {
  it('counts lines per outcome in a fixed order and drops empty outcomes', () => {
    const lines = [
      { qcResult: 'QUARANTINED' as const },
      { qcResult: 'ACCEPTED' as const },
      { qcResult: 'ACCEPTED' as const },
      { qcResult: 'PENDING' as const },
    ];
    expect(qcOutcomeCounts(lines)).toEqual([
      { result: 'ACCEPTED', count: 2 },
      { result: 'QUARANTINED', count: 1 },
      { result: 'PENDING', count: 1 },
    ]);
  });

  it('returns nothing for a receipt without lines', () => {
    expect(qcOutcomeCounts([])).toEqual([]);
  });
});
