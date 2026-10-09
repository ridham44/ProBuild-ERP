'use client';

import Link from 'next/link';
import * as React from 'react';
import { EmptyState } from '@/components/common/empty-state';
import { QueryErrorState } from '@/components/common/error-state';
import { Panel } from '@/components/common/panel';
import { StatusBadge } from '@/components/common/status-badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useCan } from '@/features/auth/components/current-user';
import { useMaterialIssues } from '@/features/material-issues/api/hooks';
import { useMaterialRequests } from '@/features/material-requests/api/hooks';
import { documentStatusKey } from '@/features/material-requests/model';
import { formatDate, formatPHP } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useBudgetVsActual } from '../api/hooks';

const LIMIT = 8;

function Section({
  title,
  href,
  loading,
  error,
  onRetry,
  empty,
  children,
  action,
}: {
  title: string;
  href: string;
  loading: boolean;
  error: unknown;
  onRetry: () => void;
  empty: boolean;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <Panel
      title={title}
      bodyClassName="p-0"
      actions={
        <>
          {action}
          <Button asChild size="sm" variant="ghost">
            <Link href={href}>View all</Link>
          </Button>
        </>
      }
    >
      {loading ? (
        <div className="p-4">
          <Skeleton className="h-16" />
        </div>
      ) : error ? (
        <QueryErrorState error={error} onRetry={onRetry} compact />
      ) : empty ? (
        <EmptyState compact title={`No ${title.toLowerCase()} yet`} description="Documents raised for this project appear here." />
      ) : (
        <ul className="divide-y divide-border">{children}</ul>
      )}
    </Panel>
  );
}

function CostSummary({ projectId }: { projectId: string }) {
  const cost = useBudgetVsActual(projectId);
  if (cost.isPending) return <Skeleton className="h-24" />;
  if (cost.isError) return <QueryErrorState error={cost.error} onRetry={() => void cost.refetch()} compact />;
  const { totals, budget } = cost.data;
  const over = Number(totals.variance) < 0;
  const figures: Array<{ label: string; value: string | null; tone?: 'danger' }> = [
    { label: 'Budget', value: totals.budget },
    { label: 'Committed on open orders', value: totals.committed },
    { label: 'Actual cost to date', value: totals.actual },
    { label: 'Remaining', value: totals.variance, ...(over ? { tone: 'danger' as const } : {}) },
  ];
  return (
    <Panel
      title="Material cost against budget"
      description={budget ? `Current budget, version ${budget.version}. Actual cost includes material issued to the project.` : 'This project has no current budget.'}
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {figures.map((figure) => (
          <div key={figure.label} className="rounded-lg border border-border bg-surface px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{figure.label}</p>
            <p className={cn('num mt-1 text-xl font-semibold leading-tight', figure.tone === 'danger' && 'text-danger')}>
              {figure.value === null ? '—' : formatPHP(figure.value)}
            </p>
          </div>
        ))}
      </div>
    </Panel>
  );
}

/** Material requests, issues and cost of one project, from the same endpoints as the inventory pages. */
export function ProjectMaterials({ projectId }: { projectId: string }) {
  const canRequests = useCan('inventory.request', 'VIEW', { projectId });
  const canIssues = useCan('inventory.issue', 'VIEW', { projectId });
  const canCost = useCan('projects.budget', 'VIEW', { projectId });
  const canCreateRequest = useCan('inventory.request', 'CREATE', { projectId });
  const canCreateIssue = useCan('inventory.issue', 'CREATE', { projectId });
  const requests = useMaterialRequests({ projectId, limit: LIMIT }, canRequests);
  const issues = useMaterialIssues({ projectId, limit: LIMIT }, canIssues);
  return (
    <div className="space-y-4">
      {canCost ? <CostSummary projectId={projectId} /> : null}
      <div className="grid gap-4 xl:grid-cols-2">
        {canRequests ? (
          <Section
            title="Material requests"
            href="/inventory/material-requests"
            loading={requests.isPending}
            error={requests.error}
            onRetry={() => void requests.refetch()}
            empty={(requests.data?.items ?? []).length === 0}
            action={
              canCreateRequest ? (
                <Button asChild size="sm">
                  <Link href="/inventory/material-requests/new">New</Link>
                </Button>
              ) : undefined
            }
          >
            {(requests.data?.items ?? []).map((request) => (
              <li key={request.id} className="space-y-0.5 px-4 py-2 text-sm">
                <div className="flex items-center gap-2">
                  <Link href={`/inventory/material-requests/${request.id}`} className="font-mono text-xs font-medium text-primary hover:underline">
                    {request.number}
                  </Link>
                  <StatusBadge status={documentStatusKey(request.status)} />
                  <span className="num ml-auto">{formatPHP(request.estimatedTotal)}</span>
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  {request.purpose ?? 'No purpose stated'} · {request.warehouse.name}
                </p>
              </li>
            ))}
          </Section>
        ) : null}
        {canIssues ? (
          <Section
            title="Material issues"
            href="/inventory/material-issues"
            loading={issues.isPending}
            error={issues.error}
            onRetry={() => void issues.refetch()}
            empty={(issues.data?.items ?? []).length === 0}
            action={
              canCreateIssue ? (
                <Button asChild size="sm">
                  <Link href="/inventory/material-issues/new">New</Link>
                </Button>
              ) : undefined
            }
          >
            {(issues.data?.items ?? []).map((issue) => (
              <li key={issue.id} className="space-y-0.5 px-4 py-2 text-sm">
                <div className="flex items-center gap-2">
                  <Link href={`/inventory/material-issues/${issue.id}`} className="font-mono text-xs font-medium text-primary hover:underline">
                    {issue.number}
                  </Link>
                  <StatusBadge status={issue.status} />
                  <span className="num ml-auto">{issue.status === 'POSTED' ? formatPHP(issue.totalCost) : '—'}</span>
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  {formatDate(issue.issueDate)} · {issue.request ? `Request ${issue.request.number}` : 'Direct issue'} · {issue.warehouse.name}
                </p>
              </li>
            ))}
          </Section>
        ) : null}
      </div>
    </div>
  );
}
