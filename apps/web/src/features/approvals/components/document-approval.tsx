'use client';

import { newIdempotencyKey } from '@probuild/api-client';
import { Check, ShieldQuestion, X } from 'lucide-react';
import * as React from 'react';
import { ApprovalTimeline } from '@/components/common/approval-timeline';
import { EmptyState } from '@/components/common/empty-state';
import { StatusBadge } from '@/components/common/status-badge';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/input';
import { toast } from '@/components/ui/toast';
import { useCurrentUser } from '@/features/auth/components/current-user';
import { errorMessage } from '@/lib/api/errors';
import type { ApprovalView } from '@/lib/api/types';
import { formatDateTime, formatPHP } from '@/lib/format';
import { buildDocumentApprovalSteps, getDocumentDecisionRights } from '../model';

export type DocumentDecision = {
  decision: 'approve' | 'reject';
  comment: string;
  idempotencyKey: string;
};

/** The approval that is in force: the newest request for the document (a resubmission replaces an old one). */
export function currentApproval(approvals: ApprovalView[]): ApprovalView | undefined {
  return [...approvals].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
}

const COMMENT_LIMIT = 500;

/**
 * Steps, approvers and comments of a document's approval, with Approve and Reject only for the person
 * whose role holds the current step. The server enforces the same rules; this only decides what to offer.
 */
export function DocumentApprovalPanel({
  approvals,
  projectId,
  onDecide,
  emptyHint,
}: {
  approvals: ApprovalView[];
  projectId: string | null;
  onDecide: (input: DocumentDecision) => Promise<unknown>;
  emptyHint: string;
}) {
  const me = useCurrentUser();
  const approval = currentApproval(approvals);
  const [comment, setComment] = React.useState('');
  const [pending, setPending] = React.useState<'approve' | 'reject' | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const keyRef = React.useRef<{ decision: string; key: string } | null>(null);

  if (!approval) {
    return (
      <EmptyState compact icon={ShieldQuestion} title="Not submitted for approval" description={emptyHint} />
    );
  }
  const rights = getDocumentDecisionRights(approval, me, projectId);

  async function decide(decision: 'approve' | 'reject'): Promise<void> {
    if (pending) return;
    const trimmed = comment.trim();
    if (decision === 'reject' && trimmed.length < 3) {
      setError('Say why you are rejecting it (at least 3 characters).');
      return;
    }
    setError(null);
    setPending(decision);
    if (keyRef.current?.decision !== decision) keyRef.current = { decision, key: newIdempotencyKey() };
    try {
      await onDecide({ decision, comment: trimmed, idempotencyKey: keyRef.current.key });
      toast.success(decision === 'approve' ? 'Approval recorded' : 'Document rejected');
      keyRef.current = null;
      setComment('');
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="space-y-4">
      <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-xs text-muted-foreground">Status</dt>
          <dd className="mt-0.5">
            <StatusBadge status={approval.status} />
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Amount under approval</dt>
          <dd className="num mt-0.5 font-medium">{formatPHP(approval.amount)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Requested by</dt>
          <dd className="mt-0.5">{approval.requestedBy.name}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Requested</dt>
          <dd className="mt-0.5">{formatDateTime(approval.createdAt)}</dd>
        </div>
      </dl>
      <ApprovalTimeline steps={buildDocumentApprovalSteps(approval, me.id)} />
      {rights.canApprove || rights.canReject ? (
        <div className="space-y-3 border-t border-border pt-4">
          <Alert tone="info" title="This is waiting on you">
            Your role holds step {approval.currentStep} of {approval.totalSteps}.
          </Alert>
          {error ? <Alert tone="danger">{error}</Alert> : null}
          <div className="space-y-1">
            <Label htmlFor="decision-comment">Comment</Label>
            <Textarea
              id="decision-comment"
              rows={3}
              maxLength={COMMENT_LIMIT}
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              placeholder="Optional for approval, required to reject. Recorded with your decision."
            />
          </div>
          <div className="flex gap-2">
            {rights.canApprove ? (
              <Button variant="primary" onClick={() => void decide('approve')} loading={pending === 'approve'} disabled={pending !== null}>
                <Check className="size-3.5" aria-hidden />
                Approve
              </Button>
            ) : null}
            {rights.canReject ? (
              <Button variant="danger" onClick={() => void decide('reject')} loading={pending === 'reject'} disabled={pending !== null}>
                <X className="size-3.5" aria-hidden />
                Reject
              </Button>
            ) : null}
          </div>
        </div>
      ) : approval.status === 'PENDING' && rights.reason ? (
        <p className="border-t border-border pt-3 text-sm text-muted-foreground">{rights.reason}</p>
      ) : null}
    </div>
  );
}
