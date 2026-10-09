import type { MaterialRequestDetail } from '@/lib/api/types';

export type MrPermissions = { submit: boolean; cancel: boolean; close: boolean; issue: boolean };

export type MrActions = { submit: boolean; cancel: boolean; close: boolean; issue: boolean };

/** Which workflow actions to offer for a status. Approval has its own panel. */
export function availableMrActions(status: string, can: MrPermissions): MrActions {
  return {
    submit: status === 'DRAFT' && can.submit,
    cancel: ['DRAFT', 'SUBMITTED', 'APPROVED'].includes(status) && can.cancel,
    close: status === 'APPROVED' && can.close,
    issue: status === 'APPROVED' && can.issue,
  };
}

/** A submitted request is shown as "Pending approval", matching the other approval-driven documents. */
export function documentStatusKey(status: string): string {
  return status === 'SUBMITTED' ? 'PENDING_APPROVAL' : status;
}

/** Approved quantity not yet issued across all lines; zero means nothing is left to issue. */
export function remainingToIssue(request: MaterialRequestDetail): number {
  return request.lines.reduce((total, line) => total + Number(line.remainingQty), 0);
}
