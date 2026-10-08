'use client';

import type { DataColumn } from '@/components/common/data-table/column-meta';
import { CalendarRange } from 'lucide-react';
import * as React from 'react';
import { DataTable } from '@/components/common/data-table/data-table';
import { EmptyState } from '@/components/common/empty-state';
import { PageHeader } from '@/components/common/page-header';
import { StatusBadge } from '@/components/common/status-badge';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { PermissionGate } from '@/features/auth/components/permission-gate';
import { MONTH_NAMES } from '@/features/company/schemas';
import type { PeriodDto } from '@/lib/api/types';
import { formatDate, manilaToday } from '@/lib/format';
import { usePeriods } from '../api/hooks';

function yearOptions(current: number): number[] {
  return Array.from({ length: 6 }, (_, index) => current + 1 - index);
}

export function PeriodsView() {
  const currentYear = Number(manilaToday().slice(0, 4));
  const [year, setYear] = React.useState(currentYear);
  const periods = usePeriods(year);

  const columns = React.useMemo<DataColumn<PeriodDto>[]>(
    () => [
      {
        id: 'period',
        header: 'Period',
        meta: { sticky: true },
        cell: ({ row }) => (
          <span className="font-medium">
            {MONTH_NAMES[row.original.month - 1]} {row.original.year}
          </span>
        ),
      },
      {
        id: 'start',
        header: 'Starts',
        cell: ({ row }) => formatDate(row.original.startDate),
        meta: { hideBelow: 'sm' },
      },
      {
        id: 'end',
        header: 'Ends',
        cell: ({ row }) => formatDate(row.original.endDate),
        meta: { hideBelow: 'sm' },
      },
      {
        id: 'status',
        header: 'Status',
        cell: ({ row }) => <StatusBadge status={row.original.closed ? 'CLOSED' : 'OPEN'} />,
      },
    ],
    [],
  );

  const data = React.useMemo(
    () => [...(periods.data ?? [])].sort((a, b) => a.month - b.month),
    [periods.data],
  );

  return (
    <PermissionGate module="finance.ledger">
      <PageHeader
        title="Accounting periods"
        description="Postings land in the period that contains their date. Closed periods reject new postings."
        breadcrumbs={[{ label: 'Finance' }, { label: 'Accounting periods' }]}
        actions={
          <div className="flex items-center gap-2">
            <Label htmlFor="period-year">Year</Label>
            <div className="w-28">
              <Select
                id="period-year"
                value={year}
                onChange={(event) => setYear(Number(event.target.value))}
              >
                {yearOptions(currentYear).map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        }
      />
      <DataTable
        caption={`Accounting periods for ${year}`}
        columns={columns}
        data={data}
        getRowId={(period) => period.id}
        loading={periods.isPending}
        error={periods.error}
        onRetry={() => void periods.refetch()}
        maxHeightClassName="max-h-none"
        emptyState={
          <EmptyState
            icon={CalendarRange}
            title={`No periods exist for ${year}`}
            description="A finance user opens a year to create its twelve monthly periods before anything can be posted to it."
          />
        }
      />
    </PermissionGate>
  );
}
