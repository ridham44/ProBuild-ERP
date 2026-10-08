import { describe, expect, it } from 'vitest';
import type { WorkflowDto } from '@/lib/api/types';
import {
  blankLine,
  buildRequisitionPayload,
  duplicateLine,
  estimatedTotal,
  mapServerErrors,
  previewApprovalRoute,
  prStatusKey,
  validateRequisition,
  type HeaderDraft,
} from './model';

const header: HeaderDraft = { projectId: 'p1', warehouseId: '', priority: 'NORMAL', requiredDate: '', purpose: ' Slab pour ', remarks: '' };
const line = (overrides = {}) =>
  blankLine({ itemId: 'i1', sku: 'CEM-40', itemName: 'Cement', baseUnit: 'bag', unit: 'bag', qty: '10', defaultUnitCost: '285', ...overrides });

describe('validateRequisition', () => {
  it('accepts a complete requisition', () => {
    expect(validateRequisition(header, [line()]).valid).toBe(true);
  });

  it('requires a project and at least one line', () => {
    const result = validateRequisition({ ...header, projectId: '' }, []);
    expect(result.header).toMatchObject({ projectId: expect.any(String), lines: expect.any(String) });
  });

  it('flags item, quantity and cost problems per line', () => {
    const bad = line({ itemId: '', qty: '1.23456', estimatedUnitCost: 'abc' });
    const result = validateRequisition(header, [bad]);
    expect(result.lines[bad.key]).toEqual({
      itemId: 'Choose an item',
      qty: 'Up to 4 decimals',
      estimatedUnitCost: 'Up to 4 decimals',
    });
  });
});

describe('totals and payload', () => {
  it('uses the typed estimate, else the default cost, with exact decimals', () => {
    expect(estimatedTotal([line({ qty: '3', estimatedUnitCost: '0.1' }), line({ qty: '0.5' })])).toBe('142.80');
  });

  it('builds the API body, leaving blank optional fields out and copying the header warehouse', () => {
    const payload = buildRequisitionPayload({ ...header, warehouseId: 'w1' }, [line({ justification: ' needed ' })]);
    expect(payload).toEqual({
      projectId: 'p1',
      priority: 'NORMAL',
      warehouseId: 'w1',
      purpose: 'Slab pour',
      lines: [{ itemId: 'i1', qty: '10', unit: 'bag', warehouseId: 'w1', justification: 'needed' }],
    });
  });

  it('duplicates a line under a new key', () => {
    const original = line();
    const copy = duplicateLine(original);
    expect(copy.key).not.toBe(original.key);
    expect({ ...copy, key: '' }).toEqual({ ...original, key: '' });
  });
});

describe('mapServerErrors', () => {
  it('routes line paths to the matching row and keeps the rest general', () => {
    const lines = [line(), line()];
    const mapped = mapServerErrors(
      [
        { path: 'lines.1.qty', message: 'Too much' },
        { path: 'projectId', message: 'Project is closed' },
        { path: '', message: 'Item CEM-40 is inactive' },
      ],
      lines,
    );
    expect(mapped.lines[lines[1]?.key ?? '']).toEqual({ qty: 'Too much' });
    expect(mapped.header.projectId).toBe('Project is closed');
    expect(mapped.general).toEqual(['Item CEM-40 is inactive']);
  });
});

describe('previewApprovalRoute', () => {
  const workflows: WorkflowDto[] = [
    {
      id: 'w',
      companyId: 'c',
      documentType: 'PURCHASE_REQUISITION',
      name: 'PR',
      active: true,
      createdAt: '',
      updatedAt: '',
      rules: [
        { id: 'r1', workflowId: 'w', minAmount: '0', maxAmount: '250000', createdAt: '', updatedAt: '', steps: [{ id: 's', ruleId: 'r1', stepOrder: 1, roleName: 'Project Manager', createdAt: '', updatedAt: '' }] },
        {
          id: 'r2', workflowId: 'w', minAmount: '250000.01', maxAmount: null, createdAt: '', updatedAt: '',
          steps: [
            { id: 's3', ruleId: 'r2', stepOrder: 2, roleName: 'Finance', createdAt: '', updatedAt: '' },
            { id: 's2', ruleId: 'r2', stepOrder: 1, roleName: 'Project Manager', createdAt: '', updatedAt: '' },
          ],
        },
      ],
    },
  ];

  it('matches the amount band, inclusive of its maximum, in step order', () => {
    expect(previewApprovalRoute(workflows, '250000.00')).toEqual({ kind: 'steps', roles: ['Project Manager'] });
    expect(previewApprovalRoute(workflows, '1164900.00')).toEqual({ kind: 'steps', roles: ['Project Manager', 'Finance'] });
  });

  it('is automatic without an active workflow and unknown when workflows cannot be read', () => {
    expect(previewApprovalRoute([], '10')).toEqual({ kind: 'automatic' });
    expect(previewApprovalRoute(undefined, '10')).toEqual({ kind: 'unknown' });
  });
});

it('shows a submitted requisition as pending approval', () => {
  expect(prStatusKey('SUBMITTED')).toBe('PENDING_APPROVAL');
  expect(prStatusKey('APPROVED')).toBe('APPROVED');
});
