import { describe, expect, it } from 'vitest';
import { availableMrActions, documentStatusKey } from './model';

const all = { submit: true, cancel: true, close: true, issue: true };

describe('availableMrActions', () => {
  it('offers submit and cancel on a draft', () => {
    expect(availableMrActions('DRAFT', all)).toEqual({ submit: true, cancel: true, close: false, issue: false });
  });

  it('offers issue, close and cancel once approved', () => {
    expect(availableMrActions('APPROVED', all)).toEqual({ submit: false, cancel: true, close: true, issue: true });
  });

  it('offers only cancel while awaiting approval', () => {
    expect(availableMrActions('SUBMITTED', all)).toEqual({ submit: false, cancel: true, close: false, issue: false });
  });

  it('offers nothing on closed, rejected or cancelled requests', () => {
    for (const status of ['CLOSED', 'REJECTED', 'CANCELLED']) {
      expect(Object.values(availableMrActions(status, all))).not.toContain(true);
    }
  });

  it('respects missing permissions', () => {
    expect(availableMrActions('APPROVED', { ...all, issue: false, close: false }).issue).toBe(false);
  });
});

describe('documentStatusKey', () => {
  it('shows a submitted request as pending approval', () => {
    expect(documentStatusKey('SUBMITTED')).toBe('PENDING_APPROVAL');
    expect(documentStatusKey('APPROVED')).toBe('APPROVED');
  });
});
