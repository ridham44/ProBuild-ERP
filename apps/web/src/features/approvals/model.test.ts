import type { Grant, SessionUser } from '@probuild/shared';
import { describe, expect, it } from 'vitest';
import type { ApprovalRequestDto } from '@/lib/api/contract';
import { buildApprovalSteps, getDecisionRights } from './model';

const grant = (action: Grant['action']): Grant => ({
  module: 'approvals.inbox',
  action,
  companyId: null,
  branchId: null,
  projectId: null,
  warehouseId: null,
});

const actor = (
  overrides: Partial<Pick<SessionUser, 'id' | 'isSuperAdmin' | 'roles' | 'grants'>> = {},
) => ({
  id: 'approver',
  isSuperAdmin: false,
  roles: ['Project Manager'],
  grants: [grant('APPROVE'), grant('REJECT')],
  ...overrides,
});

function request(overrides: Partial<ApprovalRequestDto> = {}): ApprovalRequestDto {
  return {
    id: 'r1',
    documentType: 'PURCHASE_ORDER',
    documentId: 'd1',
    documentNo: 'PO-1',
    projectId: null,
    amount: '150000.00',
    status: 'PENDING',
    currentStep: 1,
    currentRole: 'Project Manager',
    totalSteps: 2,
    stepRoles: ['Project Manager', 'Finance'],
    requestedById: 'requester',
    requestedBy: { id: 'requester', name: 'Jun Reyes' },
    createdAt: '2026-10-07T01:00:00Z',
    updatedAt: '2026-10-07T01:00:00Z',
    actions: [],
    ...overrides,
  };
}

describe('getDecisionRights', () => {
  it('offers both actions to the role holding the current step', () => {
    expect(getDecisionRights(request(), actor())).toEqual({
      canApprove: true,
      canReject: true,
      reason: null,
    });
  });

  it('offers nothing to a user whose role is not the current step', () => {
    const rights = getDecisionRights(request({ currentStep: 2 }), actor());
    expect(rights.canApprove).toBe(false);
    expect(rights.reason).toMatch(/Finance/);
  });

  it('blocks approving your own request, even with the role', () => {
    const rights = getDecisionRights(request({ requestedById: 'approver' }), actor());
    expect(rights.canApprove).toBe(false);
    expect(rights.reason).toMatch(/own request/);
  });

  it('blocks a second action by someone who already acted', () => {
    const acted = request({
      actions: [
        {
          id: 'a',
          stepOrder: 1,
          approverId: 'approver',
          decision: 'APPROVED',
          comment: null,
          createdAt: '2026-10-07T02:00:00Z',
        },
      ],
    });
    expect(getDecisionRights(acted, actor()).canApprove).toBe(false);
  });

  it('offers only the actions the permission grants allow', () => {
    const rights = getDecisionRights(request(), actor({ grants: [grant('APPROVE')] }));
    expect(rights).toMatchObject({ canApprove: true, canReject: false });
  });

  it('offers nothing once a request is decided', () => {
    expect(getDecisionRights(request({ status: 'APPROVED' }), actor()).canApprove).toBe(false);
  });

  it('lets a super administrator decide any pending step', () => {
    expect(
      getDecisionRights(
        request({ currentStep: 2 }),
        actor({ isSuperAdmin: true, roles: [], grants: [] }),
      ).canApprove,
    ).toBe(true);
  });
});

describe('buildApprovalSteps', () => {
  it('marks decided, current and waiting steps', () => {
    const steps = buildApprovalSteps(
      request({
        currentStep: 2,
        actions: [
          {
            id: 'a',
            stepOrder: 1,
            approverId: 'approver',
            decision: 'APPROVED',
            comment: 'Looks right',
            createdAt: '2026-10-07T02:00:00Z',
          },
        ],
      }),
      'approver',
    );
    expect(steps.map((step) => step.state)).toEqual(['approved', 'current']);
    expect(steps[0]).toMatchObject({ approver: 'You', comment: 'Looks right' });
  });

  it('marks steps after a rejection as not reached', () => {
    const steps = buildApprovalSteps(
      request({
        status: 'REJECTED',
        actions: [
          {
            id: 'a',
            stepOrder: 1,
            approverId: 'x',
            decision: 'REJECTED',
            comment: null,
            createdAt: '2026-10-07T02:00:00Z',
          },
        ],
      }),
      'me',
    );
    expect(steps.map((step) => step.state)).toEqual(['rejected', 'skipped']);
  });
});
