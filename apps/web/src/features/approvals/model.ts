import type { PermissionActionKey, SessionUser } from '@probuild/shared';
import type { ApprovalStepView } from '@/components/common/approval-timeline';
import { canUser } from '@/features/auth/permissions';
import type { ApprovalRequestDto } from '@/lib/api/contract';
import { titleCase } from '@/lib/format';

export const documentTypeLabel = (documentType: string): string => titleCase(documentType);

export type DecisionRights = { canApprove: boolean; canReject: boolean; reason: string | null };

type Actor = Pick<SessionUser, 'id' | 'isSuperAdmin' | 'roles' | 'grants'>;

/**
 * Whether the actor should be offered Approve / Reject. Mirrors ApprovalsService.decide so the buttons
 * only appear when the server is likely to accept them; the server still makes the final call.
 */
export function getDecisionRights(request: ApprovalRequestDto, actor: Actor): DecisionRights {
  const none = (reason: string): DecisionRights => ({
    canApprove: false,
    canReject: false,
    reason,
  });
  if (request.status !== 'PENDING') return none('This request has already been decided.');

  if (!actor.isSuperAdmin) {
    const stepRole = request.stepRoles[request.currentStep - 1];
    if (!stepRole || !actor.roles.includes(stepRole))
      return none(`Waiting on the ${stepRole ?? 'next'} role.`);
    if (request.requestedById === actor.id) return none('You cannot approve your own request.');
    if (request.actions.some((action) => action.approverId === actor.id))
      return none('You have already acted on this request.');
  }

  const scope = { projectId: request.projectId };
  const can = (action: PermissionActionKey): boolean =>
    canUser(actor, 'approvals.inbox', action, scope);
  const canApprove = can('APPROVE');
  const canReject = can('REJECT');
  if (!canApprove && !canReject) return none('Your role cannot approve or reject in this project.');
  return { canApprove, canReject, reason: null };
}

export function buildApprovalSteps(
  request: ApprovalRequestDto,
  currentUserId: string,
): ApprovalStepView[] {
  return request.stepRoles.map((roleName, index) => {
    const order = index + 1;
    const decided = request.actions.find(
      (action) =>
        action.stepOrder === order &&
        (action.decision === 'APPROVED' || action.decision === 'REJECTED'),
    );
    if (decided) {
      const approver =
        decided.approverId === currentUserId
          ? 'You'
          : decided.approverId === request.requestedById
            ? request.requestedBy.name
            : 'Approver';
      return {
        order,
        roleName,
        state: decided.decision === 'APPROVED' ? 'approved' : 'rejected',
        approver,
        decidedAt: decided.createdAt,
        comment: decided.comment,
      } satisfies ApprovalStepView;
    }
    if (request.status === 'PENDING') {
      return {
        order,
        roleName,
        state: order === request.currentStep ? 'current' : 'waiting',
      } satisfies ApprovalStepView;
    }
    return { order, roleName, state: 'skipped' } satisfies ApprovalStepView;
  });
}
