'use client';

import { newIdempotencyKey } from '@probuild/api-client';
import { Ban, PackageMinus } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';
import { ActivityPanel } from '@/components/common/activity-panel';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import type { DataColumn } from '@/components/common/data-table/column-meta';
import { DataTable } from '@/components/common/data-table/data-table';
import { EmptyState } from '@/components/common/empty-state';
import { QueryErrorState } from '@/components/common/error-state';
import { PageHeader } from '@/components/common/page-header';
import { DetailList, Panel } from '@/components/common/panel';
import { ReasonDialog } from '@/components/common/reason-dialog';
import { StatusBadge } from '@/components/common/status-badge';
import { UrlTabs } from '@/components/common/url-tabs';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/toast';
import { useCan } from '@/features/auth/components/current-user';
import { PermissionGate } from '@/features/auth/components/permission-gate';
import { errorMessage } from '@/lib/api/errors';
import type { MaterialIssueDetail, MaterialIssueLine } from '@/lib/api/types';
import { formatDate, formatDateTime, formatPHP, formatQty } from '@/lib/format';
import {
  useCancelMaterialIssue,
  useMaterialIssue,
  useMaterialIssueActivity,
  usePostMaterialIssue,
} from '../api/hooks';
import { availableMiActions } from '../model';

function SummaryStrip({ issue }: { issue: MaterialIssueDetail }) {
  const items: Array<{ label: string; value: React.ReactNode; numeric?: boolean }> = [
    { label: 'Project', value: <Link href={`/projects/${issue.projectId}`} className="hover:underline">{issue.project.name}</Link> },
    { label: 'Issued from', value: <Link href={`/inventory/warehouses/${issue.warehouseId}`} className="hover:underline">{issue.warehouse.name}</Link> },
    {
      label: 'Request',
      value: issue.request ? (
        <Link href={`/inventory/material-requests/${issue.request.id}`} className="font-mono hover:underline">
          {issue.request.number}
        </Link>
      ) : (
        'Direct issue'
      ),
    },
    { label: 'Issue date', value: formatDate(issue.issueDate) },
    { label: 'Issued by', value: issue.issuedBy?.name ?? '—' },
    { label: 'Cost', value: issue.status === 'POSTED' ? formatPHP(issue.totalCost) : '—', numeric: true },
  ];
  return (
    <dl className="mb-5 grid gap-x-6 gap-y-2 rounded-lg border border-border bg-surface px-4 py-3 text-sm sm:grid-cols-3 lg:grid-cols-6">
      {items.map((item) => (
        <div key={item.label} className="min-w-0">
          <dt className="text-xs text-muted-foreground">{item.label}</dt>
          <dd className={`mt-0.5 truncate font-medium ${item.numeric ? 'num' : ''}`}>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Lines({ issue }: { issue: MaterialIssueDetail }) {
  const posted = issue.status === 'POSTED';
  const columns = React.useMemo<DataColumn<MaterialIssueLine>[]>(
    () => [
      { id: 'no', header: '#', cell: ({ row }) => row.original.lineNo, meta: { sticky: true } },
      {
        id: 'item',
        header: 'Item',
        cell: ({ row }) => (
          <div className="min-w-0">
            <p>
              <Link href={`/inventory/items/${row.original.itemId}`} className="font-medium hover:underline">
                {row.original.item.name}
              </Link>{' '}
              <span className="font-mono text-xs text-muted-foreground">{row.original.item.sku}</span>
            </p>
            <p className="text-xs text-muted-foreground">
              {[
                row.original.batchNo ? `Batch ${row.original.batchNo}` : null,
                row.original.serialNo ? `Serial ${row.original.serialNo}` : null,
                row.original.wbsNode?.code,
                row.original.costCode?.code,
                row.original.boqItem?.itemNo,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </div>
        ),
      },
      { id: 'qty', header: 'Quantity', cell: ({ row }) => formatQty(row.original.qty, row.original.unit), meta: { numeric: true } },
      ...(posted
        ? ([
            { id: 'unitCost', header: 'Unit cost', cell: ({ row }) => formatPHP(row.original.unitCost), meta: { numeric: true, hideBelow: 'md' } },
            { id: 'total', header: 'Cost', cell: ({ row }) => <span className="font-medium">{formatPHP(row.original.totalCost)}</span>, meta: { numeric: true } },
            { id: 'returned', header: 'Returned', cell: ({ row }) => (Number(row.original.returnedQty) > 0 ? formatQty(row.original.returnedQty) : '—'), meta: { numeric: true, hideBelow: 'lg' } },
          ] satisfies DataColumn<MaterialIssueLine>[])
        : []),
    ],
    [posted],
  );
  return (
    <DataTable
      caption="Material issue lines"
      columns={columns}
      data={issue.lines}
      getRowId={(line) => line.id}
      loading={false}
      maxHeightClassName="max-h-[60vh]"
      emptyState={<EmptyState compact title="No lines" />}
    />
  );
}

function Details({ issue }: { issue: MaterialIssueDetail }) {
  return (
    <div className="space-y-4">
      <Panel title="Delivery details">
        <DetailList
          items={[
            { label: 'Received by', value: issue.receivedBy },
            { label: 'Vehicle', value: issue.vehicle },
            { label: 'Delivery reference', value: issue.deliveryRef },
            { label: 'Posted', value: issue.postedAt ? formatDateTime(issue.postedAt) : 'Not posted' },
            { label: 'Cancelled', value: issue.cancelledAt ? `${formatDateTime(issue.cancelledAt)}: ${issue.cancelReason ?? ''}` : null },
            { label: 'Remarks', value: issue.remarks, wide: true },
          ]}
        />
      </Panel>
      {issue.returns.length > 0 ? (
        <Panel title="Returns" bodyClassName="p-0">
          <ul className="divide-y divide-border">
            {issue.returns.map((entry) => (
              <li key={entry.id} className="flex items-center gap-3 px-4 py-2 text-sm">
                <span className="font-mono text-xs font-medium">{entry.number}</span>
                <StatusBadge status={entry.status} />
                <span className="text-muted-foreground">{formatDate(entry.returnDate)}</span>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}
    </div>
  );
}

export function MaterialIssueDetailView({ id }: { id: string }) {
  const query = useMaterialIssue(id);
  const issue = query.data;
  const scope = { projectId: issue?.projectId, warehouseId: issue?.warehouseId };
  const canPost = useCan('inventory.issue', 'POST', scope);
  const canCancel = useCan('inventory.issue', 'CANCEL', scope);
  const canOverride = useCan('inventory.issue', 'OVERRIDE', scope);
  const activity = useMaterialIssueActivity(id);
  const post = usePostMaterialIssue(id);
  const cancel = useCancelMaterialIssue(id);
  const [dialog, setDialog] = React.useState<'post' | 'cancel' | null>(null);
  const [dialogError, setDialogError] = React.useState<string | null>(null);
  const postKey = React.useRef<string | null>(null);
  const cancelKey = React.useRef<string | null>(null);

  const actions = issue ? availableMiActions(issue.status, { post: canPost && (issue.requestId !== null || canOverride), cancel: canCancel }) : null;

  function open(next: 'post' | 'cancel'): void {
    setDialogError(null);
    setDialog(next);
  }

  function doPost(): void {
    postKey.current ??= newIdempotencyKey();
    setDialogError(null);
    post.mutate(postKey.current, {
      onSuccess: (posted) => {
        postKey.current = null;
        setDialog(null);
        toast.success('Material issue posted', `${posted.number} has been charged to the project.`);
      },
      onError: (error) => setDialogError(errorMessage(error)),
    });
  }

  function doCancel(reason: string): void {
    cancelKey.current ??= newIdempotencyKey();
    setDialogError(null);
    cancel.mutate(
      { reason, idempotencyKey: cancelKey.current },
      {
        onSuccess: () => {
          cancelKey.current = null;
          setDialog(null);
          toast.success('Material issue cancelled');
        },
        onError: (error) => setDialogError(errorMessage(error)),
      },
    );
  }

  return (
    <PermissionGate module="inventory.issue">
      {query.isPending ? (
        <div className="space-y-4" role="status" aria-label="Loading material issue">
          <Skeleton className="h-7 w-72" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : query.isError || !issue || !actions ? (
        <QueryErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : (
        <>
          <PageHeader
            title={issue.number}
            breadcrumbs={[{ label: 'Inventory' }, { label: 'Material issues', href: '/inventory/material-issues' }, { label: issue.number }]}
            meta={<StatusBadge status={issue.status} />}
            actions={
              <>
                {actions.cancel ? (
                  <Button onClick={() => open('cancel')}>
                    <Ban className="size-3.5" aria-hidden />
                    {issue.status === 'POSTED' ? 'Reverse issue' : 'Cancel'}
                  </Button>
                ) : null}
                {actions.post ? (
                  <Button variant="primary" onClick={() => open('post')}>
                    <PackageMinus className="size-3.5" aria-hidden />
                    Post issue
                  </Button>
                ) : null}
              </>
            }
          />
          {issue.status === 'DRAFT' && !issue.request ? (
            <Alert tone="info" title="Direct issue" className="mb-4">
              This issue has no material request. Posting it needs the override permission.
            </Alert>
          ) : null}
          <SummaryStrip issue={issue} />
          <UrlTabs
            label="Material issue sections"
            tabs={[
              { id: 'lines', label: 'Lines', count: issue.lines.length, content: <Lines issue={issue} /> },
              { id: 'details', label: 'Details', content: <Details issue={issue} /> },
              {
                id: 'activity',
                label: 'Activity',
                content: (
                  <Panel>
                    <ActivityPanel items={activity.data} loading={activity.isPending} error={activity.error} onRetry={() => void activity.refetch()} />
                  </Panel>
                ),
              },
            ]}
          />
          <ConfirmDialog
            open={dialog === 'post'}
            onOpenChange={(next) => (next ? undefined : setDialog(null))}
            title={`Post ${issue.number}?`}
            description="Stock is taken from the warehouse at its current cost and charged to the project. A posted issue can only be reversed, not edited."
            confirmLabel="Post issue"
            loading={post.isPending}
            onConfirm={doPost}
          >
            {dialogError ? <Alert tone="danger">{dialogError}</Alert> : null}
          </ConfirmDialog>
          <ReasonDialog
            open={dialog === 'cancel'}
            onOpenChange={(next) => (next ? undefined : setDialog(null))}
            title={issue.status === 'POSTED' ? `Reverse ${issue.number}?` : `Cancel ${issue.number}?`}
            description={
              issue.status === 'POSTED'
                ? 'The stock goes back to the warehouse, the cost is taken off the project and the request quantities are restored. This is not possible once material has been returned against it.'
                : 'The draft issue is discarded. Nothing has left the warehouse.'
            }
            confirmLabel={issue.status === 'POSTED' ? 'Reverse issue' : 'Cancel issue'}
            tone="danger"
            loading={cancel.isPending}
            error={dialogError}
            onConfirm={doCancel}
          />
        </>
      )}
    </PermissionGate>
  );
}
