'use client';

import { Coins, FileSignature, Receipt, ShoppingCart, Wallet } from 'lucide-react';
import * as React from 'react';
import type { DataColumn } from '@/components/common/data-table/column-meta';
import { DataTable } from '@/components/common/data-table/data-table';
import { EmptyState } from '@/components/common/empty-state';
import { QueryErrorState } from '@/components/common/error-state';
import { Panel } from '@/components/common/panel';
import { Stat } from '@/components/common/stat';
import { Skeleton } from '@/components/ui/skeleton';
import { isApiError } from '@/lib/api/errors';
import type { BudgetDetail, ProjectDetail } from '@/lib/api/types';
import { subDecimal, sumDecimal } from '@/lib/decimal';
import { formatPHP, formatQty, titleCase } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useCurrentBudget, useProjectDashboard } from '../api/hooks';
import { shareOf } from '../model';

type Line = BudgetDetail['lines'][number];

function Bar({ label, value, scale, tone }: { label: string; value: string | null; scale: string; tone: string }) {
  return (
    <div className="grid grid-cols-[6rem_1fr] items-center gap-x-3 gap-y-1 text-sm sm:grid-cols-[7rem_1fr_9rem]">
      <span className="flex items-center gap-2 text-muted-foreground">
        <span className={cn('size-2 rounded-full', tone)} aria-hidden />
        {label}
      </span>
      <div className="h-2.5 overflow-hidden rounded-full bg-surface-sunken">
        <div className={cn('h-full rounded-full transition-[width] duration-500', tone)} style={{ width: `${shareOf(value, scale)}%` }} />
      </div>
      <span className="num col-span-2 text-right font-semibold sm:col-span-1">{value === null ? '—' : formatPHP(value)}</span>
    </div>
  );
}

export function ProjectFinancial({ project, canSeeBudget }: { project: ProjectDetail; canSeeBudget: boolean }) {
  const dashboard = useProjectDashboard(project.id);
  const budget = useCurrentBudget(project.id, canSeeBudget);

  const lines = React.useMemo(() => budget.data?.lines ?? [], [budget.data]);
  const byCategory = React.useMemo(() => {
    const totals = new Map<string, string[]>();
    for (const line of lines) totals.set(line.category, [...(totals.get(line.category) ?? []), line.amount]);
    return [...totals.entries()].map(([category, amounts]) => ({ category, amount: sumDecimal(amounts) }));
  }, [lines]);

  const columns = React.useMemo<DataColumn<Line>[]>(
    () => [
      {
        id: 'ref',
        header: 'BOQ item',
        meta: { sticky: true },
        cell: ({ row }) =>
          row.original.boqItem ? (
            <span>
              <span className="font-mono text-xs text-muted-foreground">{row.original.boqItem.itemNo}</span>{' '}
              {row.original.boqItem.description}
            </span>
          ) : (
            <span className="text-muted-foreground">Unallocated</span>
          ),
      },
      {
        id: 'wbs',
        header: 'WBS',
        accessorFn: (row) => row.wbsNode?.code ?? '',
        enableSorting: true,
        cell: ({ row }) => (row.original.wbsNode ? `${row.original.wbsNode.code} ${row.original.wbsNode.name}` : '—'),
        meta: { hideBelow: 'md' },
      },
      {
        id: 'costCode',
        header: 'Cost code',
        cell: ({ row }) => (row.original.costCode ? row.original.costCode.code : '—'),
        meta: { hideBelow: 'lg' },
      },
      { id: 'category', header: 'Category', cell: ({ row }) => titleCase(row.original.category), meta: { hideBelow: 'sm' } },
      {
        id: 'qty',
        header: 'Qty',
        cell: ({ row }) => (row.original.quantity ? formatQty(row.original.quantity, row.original.boqItem?.unit) : '—'),
        meta: { numeric: true, hideBelow: 'md' },
      },
      {
        id: 'amount',
        header: 'Budget',
        accessorFn: (row) => Number(row.amount),
        enableSorting: true,
        cell: ({ row }) => formatPHP(row.original.amount),
        meta: { numeric: true },
      },
    ],
    [],
  );

  if (dashboard.isPending) return <Skeleton className="h-64" />;
  if (dashboard.isError) return <QueryErrorState error={dashboard.error} onRetry={() => void dashboard.refetch()} />;
  const financial = dashboard.data.financial;
  if (!financial) {
    return (
      <Panel>
        <EmptyState
          compact
          icon={Coins}
          title="Financial figures are not available to your role"
          description="Budget and cost figures need access to the project budget."
        />
      </Panel>
    );
  }
  const budgetTotal = financial.budget?.totalAmount ?? null;
  const scale = [budgetTotal, financial.committed, financial.actual]
    .filter((value): value is string => value !== null)
    .reduce((max, value) => (Number(value) > Number(max) ? value : max), '0');
  const remaining = budgetTotal !== null && financial.committed !== null ? subDecimal(budgetTotal, financial.committed) : null;
  const overCommitted = remaining !== null && Number(remaining) < 0;
  const plannedMargin = budgetTotal !== null ? subDecimal(financial.contractValue, budgetTotal) : null;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Contract value"
          value={formatPHP(financial.contractValue)}
          hint={financial.contractValueSource === 'CONTRACT' ? 'From the active contract' : 'From the project record'}
          icon={FileSignature}
          tone="neutral"
        />
        <Stat
          label="Budget"
          value={budgetTotal === null ? '—' : formatPHP(budgetTotal)}
          hint={financial.budget ? `Version ${financial.budget.version}` : 'No budget yet. Approve an estimate on the BOQ tab.'}
          icon={Wallet}
          tone="primary"
        />
        <Stat
          label="Committed"
          value={financial.committed === null ? '—' : formatPHP(financial.committed)}
          hint={financial.committed === null ? 'Open purchase orders are not visible to your role' : 'Open purchase orders'}
          icon={ShoppingCart}
          tone="violet"
        />
        <Stat label="Actual cost" value={formatPHP(financial.actual)} hint="Posted to the project cost ledger" icon={Receipt} tone="accent" />
      </div>
      <Panel title="Budget, committed and actual">
        <div className="space-y-3">
          <Bar label="Budget" value={budgetTotal} scale={scale} tone="bg-primary" />
          <Bar label="Committed" value={financial.committed} scale={scale} tone="bg-violet" />
          <Bar label="Actual" value={financial.actual} scale={scale} tone="bg-accent" />
        </div>
        <dl className="mt-4 grid gap-4 border-t border-border pt-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-muted-foreground">Budget not yet committed</dt>
            <dd className={cn('num mt-0.5 font-medium', overCommitted && 'text-danger')}>
              {remaining === null ? '—' : formatPHP(remaining, { accounting: true })}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Planned margin (contract minus budget)</dt>
            <dd className="num mt-0.5 font-medium">{plannedMargin === null ? '—' : formatPHP(plannedMargin, { accounting: true })}</dd>
          </div>
        </dl>
      </Panel>
      {canSeeBudget ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
            <h2 className="text-base font-semibold tracking-tight">Budget lines</h2>
            {byCategory.map((entry) => (
              <span key={entry.category} className="text-sm text-muted-foreground">
                {titleCase(entry.category)} <span className="num font-medium text-foreground">{formatPHP(entry.amount)}</span>
              </span>
            ))}
          </div>
          <DataTable
            caption="Budget lines"
            columns={columns}
            data={lines}
            getRowId={(row) => row.id}
            loading={budget.isPending}
            error={budget.isError && !(isApiError(budget.error) && budget.error.status === 404) ? budget.error : undefined}
            maxHeightClassName="max-h-[50vh]"
            emptyState={
              <EmptyState
                compact
                icon={Coins}
                title="No budget lines"
                description="Approving an estimate on the BOQ tab creates the project budget from its items."
              />
            }
          />
        </div>
      ) : null}
    </div>
  );
}
