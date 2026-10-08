'use client';

import { FolderKanban, Plus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import type { DataColumn } from '@/components/common/data-table/column-meta';
import { DataTable } from '@/components/common/data-table/data-table';
import { EmptyState } from '@/components/common/empty-state';
import { FilterBar } from '@/components/common/filter-bar';
import { PageHeader } from '@/components/common/page-header';
import { SearchInput } from '@/components/common/search-input';
import { StatusBadge } from '@/components/common/status-badge';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { useCan } from '@/features/auth/components/current-user';
import { PermissionGate } from '@/features/auth/components/permission-gate';
import type { ProjectRow } from '@/lib/api/types';
import { formatDate, formatPHP } from '@/lib/format';
import { useListState } from '@/lib/list-state';
import { useProjects } from '../api/hooks';
import { PROJECT_STATUS_OPTIONS } from '../model';
import { ProgressBar } from './progress-bar';

const INITIAL = { status: '' } as Record<string, string>;

export function ProjectsView() {
  const router = useRouter();
  const canCreate = useCan('projects.project', 'CREATE');
  const list = useListState(INITIAL);
  const projects = useProjects(list.query);
  const page = projects.data;

  const columns = React.useMemo<DataColumn<ProjectRow>[]>(
    () => [
      {
        id: 'code',
        header: 'Code',
        enableSorting: true,
        accessorFn: (row) => row.code,
        cell: ({ row }) => (
          <Link href={`/projects/${row.original.id}`} className="font-mono text-xs font-medium text-primary hover:underline">
            {row.original.code}
          </Link>
        ),
        meta: { sticky: true },
      },
      {
        id: 'name',
        header: 'Project',
        enableSorting: true,
        accessorFn: (row) => row.name,
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="font-medium">{row.original.name}</p>
            {row.original.location ? (
              <p className="max-w-72 truncate text-xs text-muted-foreground">{row.original.location}</p>
            ) : null}
          </div>
        ),
      },
      {
        id: 'client',
        header: 'Client',
        accessorFn: (row) => row.customer.name,
        enableSorting: true,
        cell: ({ row }) => row.original.customer.name,
        meta: { hideBelow: 'md' },
      },
      {
        id: 'manager',
        header: 'Manager',
        cell: ({ row }) => row.original.manager?.name ?? '—',
        meta: { hideBelow: 'lg' },
      },
      { id: 'status', header: 'Status', cell: ({ row }) => <StatusBadge status={row.original.status} /> },
      {
        id: 'progress',
        header: 'Progress',
        accessorFn: (row) => Number(row.progressPct),
        enableSorting: true,
        cell: ({ row }) => <ProgressBar value={row.original.progressPct} className="w-28" />,
        meta: { hideBelow: 'sm' },
      },
      {
        id: 'contract',
        header: 'Contract value',
        accessorFn: (row) => Number(row.contractAmount),
        enableSorting: true,
        cell: ({ row }) => formatPHP(row.original.contractAmount),
        meta: { numeric: true, hideBelow: 'md' },
      },
      {
        id: 'end',
        header: 'Target finish',
        cell: ({ row }) => formatDate(row.original.revisedEndDate ?? row.original.originalEndDate),
        meta: { hideBelow: 'lg' },
      },
    ],
    [],
  );

  const filtering = Boolean(list.debounced) || list.activeCount > 0;
  return (
    <PermissionGate module="projects.project">
      <PageHeader
        title="Projects"
        description="Every job the company is delivering, from tender to close-out."
        breadcrumbs={[{ label: 'Projects' }]}
        actions={
          canCreate ? (
            <Button asChild variant="primary">
              <Link href="/projects/new">
                <Plus className="size-3.5" aria-hidden />
                New project
              </Link>
            </Button>
          ) : null
        }
      />
      <DataTable
        caption="Projects"
        columns={columns}
        data={page?.items ?? []}
        getRowId={(row) => row.id}
        loading={projects.isPending}
        error={projects.error}
        onRetry={() => void projects.refetch()}
        onRowActivate={(row) => router.push(`/projects/${row.id}`)}
        toolbar={
          <FilterBar activeCount={list.activeCount} onReset={list.clearFilters}>
            <SearchInput value={list.search} onValueChange={list.setSearch} placeholder="Search by name or code" />
            <div className="w-40">
              <Select aria-label="Status" value={list.filters.status ?? ''} onChange={(event) => list.setFilter('status', event.target.value)}>
                <option value="">All statuses</option>
                {PROJECT_STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>
          </FilterBar>
        }
        pagination={{
          count: page?.items.length ?? 0,
          hasPrevious: list.paging.hasPrevious,
          hasNext: Boolean(page?.nextCursor),
          onPrevious: list.paging.goPrevious,
          onNext: () => list.paging.goNext(page?.nextCursor ?? null),
          loading: projects.isFetching,
        }}
        emptyState={
          <EmptyState
            icon={FolderKanban}
            title={filtering ? 'No projects match these filters' : 'No projects yet'}
            description={
              filtering
                ? 'Clear the filters or search for a different name or code.'
                : 'Create the first project to set up its WBS, bill of quantities and budget, then start procuring against it.'
            }
            action={
              canCreate && !filtering ? (
                <Button asChild variant="primary">
                  <Link href="/projects/new">
                    <Plus className="size-3.5" aria-hidden />
                    New project
                  </Link>
                </Button>
              ) : undefined
            }
          />
        }
      />
    </PermissionGate>
  );
}
