'use client';

import { Check, X } from 'lucide-react';
import * as React from 'react';
import { ApprovalTimeline } from '@/components/common/approval-timeline';
import { StatusBadge } from '@/components/common/status-badge';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Drawer, DrawerContent } from '@/components/ui/drawer';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/input';
import { toast } from '@/components/ui/toast';
import { useCurrentUser } from '@/features/auth/components/current-user';
import type { ApprovalRequestDto } from '@/lib/api/contract';
import { errorMessage } from '@/lib/api/errors';
import { formatDateTime, formatPHP } from '@/lib/format';
import { useDecideApproval } from '../api/hooks';
import { buildApprovalSteps, documentTypeLabel, getDecisionRights } from '../model';

const COMMENT_LIMIT = 500;

function Summary({ request }: { request: ApprovalRequestDto }) {
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
      <div>
        <dt className="text-xs text-muted-foreground">Document</dt>
        <dd className="font-medium">
          {request.documentNo ?? documentTypeLabel(request.documentType)}
        </dd>
      </div>
      <div>
        <dt className="text-xs text-muted-foreground">Type</dt>
        <dd>{documentTypeLabel(request.documentType)}</dd>
      </div>
      <div>
        <dt className="text-xs text-muted-foreground">Amount</dt>
        <dd className="num font-medium">{formatPHP(request.amount)}</dd>
      </div>
      <div>
        <dt className="text-xs text-muted-foreground">Status</dt>
        <dd>
          <StatusBadge status={request.status} />
        </dd>
      </div>
      <div>
        <dt className="text-xs text-muted-foreground">Requested by</dt>
        <dd>{request.requestedBy.name}</dd>
      </div>
      <div>
        <dt className="text-xs text-muted-foreground">Requested</dt>
        <dd>{formatDateTime(request.createdAt)}</dd>
      </div>
    </dl>
  );
}

function DecisionPanel({
  request,
  onDecided,
}: {
  request: ApprovalRequestDto;
  onDecided: () => void;
}) {
  const me = useCurrentUser();
  const decide = useDecideApproval();
  const rights = getDecisionRights(request, me);
  const [comment, setComment] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  function submit(decision: 'approve' | 'reject'): void {
    if (decide.isPending) return;
    setError(null);
    decide.mutate(
      { id: request.id, decision, ...(comment.trim() ? { comment: comment.trim() } : {}) },
      {
        onSuccess: (updated) => {
          toast.success(
            decision === 'approve' ? 'Approval recorded' : 'Request rejected',
            updated.status === 'PENDING'
              ? `Now waiting on step ${updated.currentStep} of ${updated.totalSteps}.`
              : undefined,
          );
          onDecided();
        },
        onError: (cause) => setError(errorMessage(cause)),
      },
    );
  }

  if (!rights.canApprove && !rights.canReject) {
    return rights.reason ? <p className="text-sm text-muted-foreground">{rights.reason}</p> : null;
  }

  return (
    <div className="space-y-3 border-t border-border pt-4">
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <div className="space-y-1">
        <Label htmlFor={`comment-${request.id}`}>Comment</Label>
        <Textarea
          id={`comment-${request.id}`}
          rows={3}
          maxLength={COMMENT_LIMIT}
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          placeholder="Optional. Recorded with your decision."
        />
        <p className="num text-right text-xs text-muted-foreground">
          {comment.length}/{COMMENT_LIMIT}
        </p>
      </div>
      <div className="flex gap-2">
        {rights.canApprove ? (
          <Button
            variant="primary"
            onClick={() => submit('approve')}
            loading={decide.isPending && decide.variables?.decision === 'approve'}
            disabled={decide.isPending}
          >
            <Check className="size-3.5" aria-hidden />
            Approve
          </Button>
        ) : null}
        {rights.canReject ? (
          <Button
            variant="danger"
            onClick={() => submit('reject')}
            loading={decide.isPending && decide.variables?.decision === 'reject'}
            disabled={decide.isPending}
          >
            <X className="size-3.5" aria-hidden />
            Reject
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export function ApprovalDetailDrawer({
  request,
  onClose,
}: {
  request: ApprovalRequestDto | null;
  onClose: () => void;
}) {
  const me = useCurrentUser();
  return (
    <Drawer open={request !== null} onOpenChange={(open) => (open ? undefined : onClose())}>
      <DrawerContent
        title={
          request
            ? `Approval: ${request.documentNo ?? documentTypeLabel(request.documentType)}`
            : 'Approval'
        }
        description={request ? documentTypeLabel(request.documentType) : undefined}
      >
        {request ? (
          <div className="scroll-thin flex-1 space-y-5 overflow-y-auto p-4">
            <Summary request={request} />
            <section aria-label="Approval steps" className="space-y-3 border-t border-border pt-4">
              <h3 className="text-sm font-medium">Steps</h3>
              <ApprovalTimeline steps={buildApprovalSteps(request, me.id)} />
            </section>
            <DecisionPanel key={request.id} request={request} onDecided={onClose} />
          </div>
        ) : null}
      </DrawerContent>
    </Drawer>
  );
}
