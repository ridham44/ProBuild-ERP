'use client';

import type { DataColumn } from '@/components/common/data-table/column-meta';
import { MonitorSmartphone } from 'lucide-react';
import * as React from 'react';
import { DataTable } from '@/components/common/data-table/data-table';
import { EmptyState } from '@/components/common/empty-state';
import { PageHeader } from '@/components/common/page-header';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';
import type { SessionDto } from '@/lib/api/contract';
import { errorMessage } from '@/lib/api/errors';
import { formatDateTime, formatRelative } from '@/lib/format';
import { describeUserAgent } from '@/lib/user-agent';
import { useRevokeOtherSessions, useRevokeSession, useSessions } from '../api/hooks';

export function SessionsView() {
  const sessions = useSessions();
  const revoke = useRevokeSession();
  const revokeOthers = useRevokeOtherSessions();
  const [target, setTarget] = React.useState<SessionDto | null>(null);
  const [confirmOthers, setConfirmOthers] = React.useState(false);
  const otherCount = sessions.data?.filter((session) => !session.current).length ?? 0;

  const columns = React.useMemo<DataColumn<SessionDto>[]>(
    () => [
      {
        id: 'device',
        header: 'Device',
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <span className="font-medium">{describeUserAgent(row.original.userAgent)}</span>
            {row.original.current ? <Badge tone="primary">This device</Badge> : null}
          </div>
        ),
      },
      {
        id: 'ip',
        header: 'IP address',
        cell: ({ row }) => <span className="font-mono text-xs">{row.original.ip ?? '—'}</span>,
        meta: { hideBelow: 'md' },
      },
      {
        id: 'lastSeen',
        header: 'Last active',
        cell: ({ row }) => (
          <span title={formatDateTime(row.original.lastSeenAt)}>
            {formatRelative(row.original.lastSeenAt)}
          </span>
        ),
      },
      {
        id: 'signedIn',
        header: 'Signed in',
        cell: ({ row }) => formatDateTime(row.original.createdAt),
        meta: { hideBelow: 'lg' },
      },
      {
        id: 'expires',
        header: 'Expires',
        cell: ({ row }) => formatDateTime(row.original.expiresAt),
        meta: { hideBelow: 'lg' },
      },
      {
        id: 'actions',
        header: () => <span className="sr-only">Actions</span>,
        enableHiding: false,
        meta: { numeric: true },
        cell: ({ row }) =>
          row.original.current ? null : (
            <Button size="sm" onClick={() => setTarget(row.original)}>
              Sign out
            </Button>
          ),
      },
    ],
    [],
  );

  function confirmRevoke(): void {
    if (!target) return;
    revoke.mutate(target.id, {
      onSuccess: () => {
        toast.success('Session signed out');
        setTarget(null);
      },
      onError: (error) => toast.error('Could not sign out that session', errorMessage(error)),
    });
  }

  function confirmRevokeOthers(): void {
    revokeOthers.mutate(undefined, {
      onSuccess: (result) => {
        toast.success(
          `Signed out ${result.revoked} other ${result.revoked === 1 ? 'session' : 'sessions'}`,
        );
        setConfirmOthers(false);
      },
      onError: (error) => toast.error('Could not sign out other sessions', errorMessage(error)),
    });
  }

  return (
    <>
      <PageHeader
        title="Sessions and devices"
        description="Everywhere you are currently signed in. Sign out any you do not recognise, then change your password."
        breadcrumbs={[{ label: 'Account' }, { label: 'Sessions' }]}
        actions={
          <Button onClick={() => setConfirmOthers(true)} disabled={otherCount === 0}>
            Sign out other sessions
          </Button>
        }
      />
      <DataTable
        caption="Active sessions"
        columns={columns}
        data={sessions.data ?? []}
        getRowId={(session) => session.id}
        loading={sessions.isPending}
        error={sessions.error}
        onRetry={() => void sessions.refetch()}
        emptyState={
          <EmptyState
            icon={MonitorSmartphone}
            title="No active sessions"
            description="Your current session should always appear here. Reload the page to try again."
          />
        }
      />
      <ConfirmDialog
        open={target !== null}
        onOpenChange={(open) => (open ? undefined : setTarget(null))}
        title="Sign out this session?"
        description={
          target ? `${describeUserAgent(target.userAgent)} will need to sign in again.` : ''
        }
        confirmLabel="Sign out"
        tone="danger"
        loading={revoke.isPending}
        onConfirm={confirmRevoke}
      />
      <ConfirmDialog
        open={confirmOthers}
        onOpenChange={setConfirmOthers}
        title="Sign out all other sessions?"
        description={`${otherCount} other ${otherCount === 1 ? 'session' : 'sessions'} will be signed out. This device stays signed in.`}
        confirmLabel="Sign out others"
        tone="danger"
        loading={revokeOthers.isPending}
        onConfirm={confirmRevokeOthers}
      />
    </>
  );
}
