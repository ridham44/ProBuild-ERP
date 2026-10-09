'use client';

import { ArrowRight, ClipboardCheck } from 'lucide-react';
import Link from 'next/link';
import { EmptyState } from '@/components/common/empty-state';
import { QueryErrorState } from '@/components/common/error-state';
import { Panel } from '@/components/common/panel';
import { Button } from '@/components/ui/button';
import { SkeletonLines } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from '@/components/ui/table';
import { useApprovals } from '@/features/approvals/api/hooks';
import { documentHref, documentTypeLabel } from '@/features/approvals/model';
import { formatPHP, formatRelative } from '@/lib/format';

const LIMIT = 100;
const SHOWN = 6;

/** The current user's approval queue: the first thing most approvers open the app for. */
export function WaitingOnYou() {
  const approvals = useApprovals({ mine: true, limit: LIMIT });
  const rows = approvals.data?.items.slice(0, SHOWN) ?? [];
  const total = approvals.data?.items.length ?? 0;
  return (
    <Panel
      title="Waiting on you"
      description={
        total > SHOWN
          ? `Showing the oldest ${SHOWN} of ${total}${approvals.data?.nextCursor ? '+' : ''} requests`
          : 'Documents at an approval step for your role'
      }
      actions={
        <Button asChild size="sm" variant="ghost">
          <Link href="/approvals">
            Open approvals
            <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        </Button>
      }
      bodyClassName="p-0"
    >
      {approvals.isPending ? (
        <SkeletonLines lines={4} className="p-5" />
      ) : approvals.isError ? (
        <QueryErrorState
          error={approvals.error}
          onRetry={() => void approvals.refetch()}
          retrying={approvals.isFetching}
          compact
        />
      ) : rows.length === 0 ? (
        <EmptyState
          compact
          icon={ClipboardCheck}
          title="You are all caught up"
          description="Documents that reach an approval step for your role appear here and in your notifications."
        />
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHead>
              <tr>
                <TableHeaderCell>Document</TableHeaderCell>
                <TableHeaderCell>Stage</TableHeaderCell>
                <TableHeaderCell numeric>Amount</TableHeaderCell>
                <TableHeaderCell className="hidden sm:table-cell">Requested</TableHeaderCell>
              </tr>
            </TableHead>
            <TableBody>
              {rows.map((request) => {
                const href = documentHref(request.documentType, request.documentId);
                return (
                  <TableRow key={request.id}>
                    <TableCell>
                      {href ? (
                        <Link href={href} className="doc-link">
                          {request.documentNo ?? 'Open'}
                        </Link>
                      ) : (
                        <span className="doc-id">{request.documentNo ?? '—'}</span>
                      )}
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {documentTypeLabel(request.documentType)}
                      </p>
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-pending">
                        <span className="size-1.5 rounded-full bg-pending" aria-hidden />
                        Step {request.currentStep} of {request.totalSteps}
                      </span>
                      {request.currentRole ? (
                        <p className="text-xs text-muted-foreground">{request.currentRole}</p>
                      ) : null}
                    </TableCell>
                    <TableCell numeric className="font-medium">
                      {formatPHP(request.amount)}
                    </TableCell>
                    <TableCell className="hidden text-xs text-muted-foreground sm:table-cell">
                      {formatRelative(request.createdAt)}
                      <p className="text-subtle-foreground">by {request.requestedBy.name}</p>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </Panel>
  );
}
