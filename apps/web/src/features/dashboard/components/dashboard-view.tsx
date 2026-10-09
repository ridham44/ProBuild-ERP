'use client';

import { Bell, Boxes, CalendarRange, Scale } from 'lucide-react';
import Link from 'next/link';
import { Stat } from '@/components/common/stat';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { usePeriods } from '@/features/accounting/api/hooks';
import { useApprovals } from '@/features/approvals/api/hooks';
import { useCan } from '@/features/auth/components/current-user';
import { MONTH_NAMES } from '@/features/company/schemas';
import { useNotifications } from '@/features/notifications/api/hooks';
import { useStockBalances } from '@/features/stock/api/hooks';
import { manilaToday } from '@/lib/format';
import { cappedCount, formatCappedCount } from '../model';
import { ActiveProjects } from './active-projects';
import { DashboardHeader } from './dashboard-header';
import { NotificationFeed } from './notification-feed';
import { ProcurementPipeline } from './procurement-pipeline';
import { WaitingOnYou } from './waiting-on-you';

const LIMIT = 100;

function PeriodAlert() {
  const year = Number(manilaToday().slice(0, 4));
  const month = Number(manilaToday().slice(5, 7));
  const periods = usePeriods(year);
  if (!periods.data) return null;
  const current = periods.data.find((period) => period.month === month);
  const label = `${MONTH_NAMES[month - 1]} ${year}`;
  if (current && !current.closed) return null;
  return (
    <Alert
      tone="warning"
      title={current ? `${label} is closed` : `No accounting period exists for ${label}`}
      action={
        <Button asChild size="sm">
          <Link href="/finance/accounting-periods">View periods</Link>
        </Button>
      }
    >
      {current
        ? 'New postings dated this month will be rejected unless the period is reopened.'
        : 'Postings dated this month cannot be recorded until finance opens the year.'}
    </Alert>
  );
}

/** One KPI per area the user can open; nothing is shown for modules their role cannot see. */
function AtAGlance() {
  const canApprove = useCan('approvals.inbox', 'VIEW');
  const canSeeLedger = useCan('finance.ledger', 'VIEW');
  const canSeeStock = useCan('inventory.stock', 'VIEW');
  const waiting = useApprovals({ mine: true, limit: LIMIT }, canApprove);
  const notifications = useNotifications();
  const lowStock = useStockBalances({ belowMinimum: 'true', limit: LIMIT }, canSeeStock);
  const year = Number(manilaToday().slice(0, 4));
  const month = Number(manilaToday().slice(5, 7));
  const periods = usePeriods(year, canSeeLedger);
  const currentPeriod = periods.data?.find((period) => period.month === month);

  return (
    <section aria-label="At a glance" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {canApprove ? (
        <Stat label="Waiting on you" value={formatCappedCount(cappedCount(waiting.data))} hint="approval requests for your role" href="/approvals" loading={waiting.isPending} icon={Scale} tone="pending" />
      ) : null}
      <Stat label="Unread notifications" value={notifications.data?.unread ?? 0} hint="approvals, receipts and issues" loading={notifications.isPending} icon={Bell} tone="primary" />
      {canSeeStock ? (
        <Stat label="Stock below minimum" value={formatCappedCount(cappedCount(lowStock.data))} hint="item and warehouse lines" href="/inventory/stock" loading={lowStock.isPending} icon={Boxes} tone={(lowStock.data?.items.length ?? 0) > 0 ? 'warning' : 'accent'} />
      ) : null}
      {canSeeLedger ? (
        <Stat
          label="Accounting period"
          value={currentPeriod ? `${MONTH_NAMES[month - 1]?.slice(0, 3)} ${currentPeriod.year}` : '—'}
          hint={currentPeriod ? (currentPeriod.closed ? 'Closed for posting' : 'Open for posting') : 'Not opened yet'}
          href="/finance/accounting-periods"
          loading={periods.isPending}
          icon={CalendarRange}
          tone="violet"
        />
      ) : null}
    </section>
  );
}

export function DashboardView() {
  const canApprove = useCan('approvals.inbox', 'VIEW');
  const canSeeLedger = useCan('finance.ledger', 'VIEW');
  const canSeeProjects = useCan('projects.project', 'VIEW');
  const hasMainColumn = canApprove || canSeeProjects;

  return (
    <>
      <DashboardHeader />
      <div className="space-y-5">
        {canSeeLedger ? <PeriodAlert /> : null}
        <AtAGlance />
        <ProcurementPipeline />
        <div className={hasMainColumn ? 'grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_24rem]' : ''}>
          {hasMainColumn ? (
            <div className="min-w-0 space-y-5">
              {canApprove ? <WaitingOnYou /> : null}
              {canSeeProjects ? <ActiveProjects /> : null}
            </div>
          ) : null}
          <NotificationFeed />
        </div>
      </div>
    </>
  );
}
