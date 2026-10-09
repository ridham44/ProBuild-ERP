import { describe, expect, it } from 'vitest';
import { isProjectOverdue, projectTargetFinish } from './model';

describe('projectTargetFinish', () => {
  it('prefers the revised finish over the original', () => {
    expect(projectTargetFinish({ revisedEndDate: '2027-03-01', originalEndDate: '2026-12-01' })).toBe('2027-03-01');
    expect(projectTargetFinish({ revisedEndDate: null, originalEndDate: '2026-12-01' })).toBe('2026-12-01');
  });
});

describe('isProjectOverdue', () => {
  const now = new Date('2026-10-09T02:00:00Z');
  const lapsed = { revisedEndDate: null, originalEndDate: '2026-09-30T00:00:00Z' };

  it('flags an open project whose target finish has passed', () => {
    for (const status of ['PIPELINE', 'ACTIVE', 'ON_HOLD']) {
      expect(isProjectOverdue({ status, ...lapsed }, now)).toBe(true);
    }
  });

  it('never flags finished or cancelled projects', () => {
    for (const status of ['COMPLETED', 'CLOSED', 'CANCELLED']) {
      expect(isProjectOverdue({ status, ...lapsed }, now)).toBe(false);
    }
  });

  it('uses the revised date, so a re-baselined project is not overdue', () => {
    expect(
      isProjectOverdue(
        { status: 'ACTIVE', revisedEndDate: '2027-01-31T00:00:00Z', originalEndDate: '2026-09-30T00:00:00Z' },
        now,
      ),
    ).toBe(false);
  });

  it('is not overdue without a finish date', () => {
    expect(isProjectOverdue({ status: 'ACTIVE', revisedEndDate: null, originalEndDate: null }, now)).toBe(false);
  });
});
