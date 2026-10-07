'use client';

import { BellOff, ClipboardCheck } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';
import { EmptyState } from '@/components/common/empty-state';
import { QueryErrorState } from '@/components/common/error-state';
import { PageHeader } from '@/components/common/page-header';
import { Stat } from '@/components/common/stat';
import { StatusBadge } from '@/components/common/status-badge';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from '@/components/ui/table';
import { usePeriods } from '@/features/accounting/api/hooks';
import { useApprovals } from '@/features/approvals/api/hooks';
import { documentTypeLabel } from '@/features/approvals/model';
import { useCan, useCurrentUser } from '@/features/auth/components/current-user';
import { MONTH_NAMES } from '@/features/company/schemas';
import { useNotifications } from '@/features/notifications/api/hooks';
import type { NotificationDto } from '@/lib/api/contract';
import { formatPHP, formatRelative, manilaToday } from '@/lib/format';

const WAITING_LIMIT = 100;

function todayLabel(): string {
  const weekday = new Intl.DateTimeFormat('en-PH', {
    weekday: 'long',
    timeZone: 'Asia/Manila',
  }).format(new Date());
  const [year, month, day] = manilaToday().split('-').map(Number);
  return `${weekday}, ${String(day).padStart(2, '0')} ${MONTH_NAMES[(month ?? 1) - 1]?.slice(0, 3)} ${year}`;
}

function RecentNotifications({ items }: { items: NotificationDto[] }) {
  return (
    <ul className="divide-y divide-border">
      {items.slice(0, 6).map((item) => (
        <li key={item.id} className="flex items-start gap-2.5 py-2.5 first:pt-0 last:pb-0">
          <span
            className={
              item.readAt
                ? 'mt-1.5 size-1.5 shrink-0'
                : 'mt-1.5 size-1.5 shrink-0 rounded-full bg-primary'
            }
            aria-hidden
          />
          <div className="min-w-0 flex-1">
            <p className={item.readAt ? 'text-sm text-muted-foreground' : 'text-sm font-medium'}>
              {item.title}
            </p>
            {item.body ? <p className="text-xs text-muted-foreground">{item.body}</p> : null}
            <p className="text-xs text-subtle-foreground">{formatRelative(item.createdAt)}</p>
          </div>
          {item.readAt ? null : <span className="sr-only">Unread</span>}
        </li>
      ))}
    </ul>
  );
}

function WaitingOnYou() {
  const approvals = useApprovals({ mine: true, limit: WAITING_LIMIT });
  const rows = approvals.data?.items.slice(0, 5) ?? [];
  return (
    <section className="rounded-lg border border-border bg-surface" aria-label="Waiting on you">
      <header className="flex h-11 items-center justify-between border-b border-border px-4">
        <h2 className="text-base font-semibold">Waiting on you</h2>
        <Button asChild size="sm" variant="ghost">
          <Link href="/approvals">Open approvals</Link>
        </Button>
      </header>
      {approvals.isPending ? (
        <div className="space-y-2 p-4" role="status" aria-label="Loading approvals">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-6" />
          ))}
        </div>
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
          title="Nothing is waiting on you"
          description="Documents that reach an approval step for your role appear here and in your notifications."
        />
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHead>
              <tr>
                <TableHeaderCell>Document</TableHeaderCell>
                <TableHeaderCell numeric>Amount</TableHeaderCell>
                <TableHeaderCell>Status</TableHeaderCell>
                <TableHeaderCell>Requested</TableHeaderCell>
              </tr>
            </TableHead>
            <TableBody>
              {rows.map((request) => (
                <TableRow key={request.id}>
                  <TableCell>
                    <p className="font-mono text-xs font-medium">{request.documentNo ?? '—'}</p>
                    <p className="text-xs text-muted-foreground">
                      {documentTypeLabel(request.documentType)}
                    </p>
                  </TableCell>
                  <TableCell numeric>{formatPHP(request.amount)}</TableCell>
                  <TableCell>
                    <StatusBadge status={request.status} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatRelative(request.createdAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  );
}

function PeriodAlert() {
  const year = Number(manilaToday().slice(0, 4));
  const month = Number(manilaToday().slice(5, 7));
  const periods = usePeriods(year);
  if (!periods.data) return null;
  const current = periods.data.find((period) => period.month === month);
  const label = `${MONTH_NAMES[month - 1]} ${year}`;
  if (!current) {
    return (
      <Alert
        tone="warning"
        title={`No accounting period exists for ${label}`}
        action={
          <Button asChild size="sm">
            <Link href="/finance/accounting-periods">View periods</Link>
          </Button>
        }
      >
        Postings dated this month cannot be recorded until finance opens the year.
      </Alert>
    );
  }
  if (current.closed) {
    return (
      <Alert
        tone="warning"
        title={`${label} is closed`}
        action={
          <Button asChild size="sm">
            <Link href="/finance/accounting-periods">View periods</Link>
          </Button>
        }
      >
        New postings dated this month will be rejected unless the period is reopened.
      </Alert>
    );
  }
  return null;
}

export function DashboardView() {
  const user = useCurrentUser();
  const canApprove = useCan('approvals.inbox', 'VIEW');
  const canSeeLedger = useCan('finance.ledger', 'VIEW');
  const waiting = useApprovals({ mine: true, limit: WAITING_LIMIT }, canApprove);
  const notifications = useNotifications();
  const waitingCount = waiting.data
    ? `${waiting.data.items.length}${waiting.data.nextCursor ? '+' : ''}`
    : '';
  const month = Number(manilaToday().slice(5, 7));
  const periods = usePeriods(Number(manilaToday().slice(0, 4)), canSeeLedger);
  const currentPeriod = periods.data?.find((period) => period.month === month);

  return (
    <>
      <PageHeader title={`Welcome, ${user.name.split(' ')[0]}`} description={todayLabel()} />
      <div className="space-y-4">
        {canSeeLedger ? <PeriodAlert /> : null}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {canApprove ? (
            <Stat
              label="Waiting on you"
              value={waitingCount}
              hint="approval requests"
              href="/approvals"
              loading={waiting.isPending}
            />
          ) : null}
          <Stat
            label="Unread notifications"
            value={notifications.data?.unread ?? 0}
            hint="in your inbox"
            loading={notifications.isPending}
          />
          {canSeeLedger && currentPeriod ? (
            <Stat
              label="Accounting period"
              value={`${MONTH_NAMES[month - 1]?.slice(0, 3)} ${currentPeriod.year}`}
              hint={currentPeriod.closed ? 'Closed' : 'Open for posting'}
              href="/finance/accounting-periods"
            />
          ) : null}
        </div>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
          {canApprove ? <WaitingOnYou /> : <div />}
          <section
            className="rounded-lg border border-border bg-surface"
            aria-label="Recent notifications"
          >
            <header className="flex h-11 items-center border-b border-border px-4">
              <h2 className="text-base font-semibold">Recent notifications</h2>
            </header>
            <div className="p-4">
              {notifications.isPending ? (
                <Skeleton className="h-24" />
              ) : notifications.isError ? (
                <QueryErrorState
                  error={notifications.error}
                  onRetry={() => void notifications.refetch()}
                  compact
                />
              ) : notifications.data.items.length === 0 ? (
                <EmptyState
                  compact
                  icon={BellOff}
                  title="No notifications yet"
                  description="Approval requests and decisions that involve you show up here."
                />
              ) : (
                <RecentNotifications items={notifications.data.items} />
              )}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
