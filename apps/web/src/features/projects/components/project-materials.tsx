'use client';

import Link from 'next/link';
import * as React from 'react';
import { EmptyState } from '@/components/common/empty-state';
import { QueryErrorState } from '@/components/common/error-state';
import { Panel } from '@/components/common/panel';
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '@/components/ui/table';
import { StatusBadge } from '@/components/common/status-badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useCan } from '@/features/auth/components/current-user';
import { useMaterialIssues } from '@/features/material-issues/api/hooks';
import { useMaterialRequests } from '@/features/material-requests/api/hooks';
import { documentStatusKey } from '@/features/material-requests/model';
import { formatDate, formatPHP } from '@/lib/format';
import { useMaterialCost } from '../api/hooks';

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
  const cost = useMaterialCost(projectId);
  if (cost.isPending) return <Skeleton className="h-24" />;
  if (cost.isError) return <QueryErrorState error={cost.error} onRetry={() => void cost.refetch()} compact />;
  const { issued, returned, actual, lines } = cost.data;
  const figures = [
    { label: 'Material actual cost', value: actual },
    { label: 'Issued to project', value: issued },
    { label: 'Returned to stock', value: returned },
  ];
  return (
    <Panel
      title="Material cost"
      description="Material issued to this project less material returned. Total project cost, including labour and other spend, is on the Financial tab."
    >
      <div className="grid gap-3 sm:grid-cols-3">
        {figures.map((figure) => (
          <div key={figure.label} className="rounded-lg bg-surface-muted px-4 py-3">
            <p className="text-xs font-medium text-muted-foreground">{figure.label}</p>
            <p className="num mt-1 text-xl font-semibold leading-tight">{formatPHP(figure.value)}</p>
          </div>
        ))}
      </div>
      {lines.length > 0 ? (
        <div className="mt-4 overflow-x-auto rounded-lg border border-border">
          <Table>
            <TableHead>
              <tr>
                <TableHeaderCell>Cost code</TableHeaderCell>
                <TableHeaderCell numeric>Issued</TableHeaderCell>
                <TableHeaderCell numeric>Returned</TableHeaderCell>
                <TableHeaderCell numeric>Material actual cost</TableHeaderCell>
              </tr>
            </TableHead>
            <TableBody>
              {lines.map((line) => (
                <TableRow key={line.costCode?.id ?? 'none'}>
                  <TableCell>
                    {line.costCode ? (
                      <>
                        <span className="font-mono text-xs text-muted-foreground">{line.costCode.code}</span> {line.costCode.name}
                      </>
                    ) : (
                      <span className="text-subtle-foreground">No cost code</span>
                    )}
                  </TableCell>
                  <TableCell numeric>{formatPHP(line.issued)}</TableCell>
                  <TableCell numeric>{formatPHP(line.returned)}</TableCell>
                  <TableCell numeric className="font-semibold">{formatPHP(line.actual)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}
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
                  <Link href={`/inventory/material-requests/${request.id}`} className="doc-link">
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
                  <Link href={`/inventory/material-issues/${issue.id}`} className="doc-link">
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
