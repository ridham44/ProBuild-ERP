'use client';

import { AlertTriangle, FolderKanban, Plus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import type { DataColumn } from '@/components/common/data-table/column-meta';
import { DataTable } from '@/components/common/data-table/data-table';
import { EmptyState } from '@/components/common/empty-state';
import { QueryErrorState } from '@/components/common/error-state';
import { FilterBar } from '@/components/common/filter-bar';
import { PageHeader } from '@/components/common/page-header';
import { Pagination, type PaginationProps } from '@/components/common/pagination';
import { SearchInput } from '@/components/common/search-input';
import { StatusBadge } from '@/components/common/status-badge';
import { useListView, ViewToggle } from '@/components/common/view-toggle';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { useCan } from '@/features/auth/components/current-user';
import { PermissionGate } from '@/features/auth/components/permission-gate';
import type { ProjectRow } from '@/lib/api/types';
import { formatDate, formatPHP } from '@/lib/format';
import { useListState } from '@/lib/list-state';
import { useProjects } from '../api/hooks';
import { isProjectOverdue, PROJECT_STATUS_OPTIONS, projectTargetFinish } from '../model';
import { ProjectCards } from './project-cards';
import { ProgressBar, projectProgressTone } from './progress-bar';

const INITIAL = { status: '' } as Record<string, string>;

function TargetFinish({ project }: { project: ProjectRow }) {
  const date = formatDate(projectTargetFinish(project));
  if (!isProjectOverdue(project)) return <span className="text-muted-foreground">{date}</span>;
  return (
    <span className="inline-flex items-center gap-1 font-medium text-danger" title="Past target finish">
      <AlertTriangle className="size-3.5" aria-hidden />
      {date}
      <span className="sr-only">(past target finish)</span>
    </span>
  );
}

function useProjectColumns(): DataColumn<ProjectRow>[] {
  return React.useMemo<DataColumn<ProjectRow>[]>(
    () => [
      {
        id: 'name',
        header: 'Project',
        enableSorting: true,
        accessorFn: (row) => row.name,
        cell: ({ row }) => (
          <div className="min-w-0 max-w-80">
            <Link href={`/projects/${row.original.id}`} className="block truncate font-medium text-foreground hover:text-primary hover:underline">
              {row.original.name}
            </Link>
            <p className="truncate text-xs text-muted-foreground">
              <span className="font-mono">{row.original.code}</span>
              {row.original.location ? ` · ${row.original.location}` : ''}
            </p>
          </div>
        ),
        meta: { sticky: true, label: 'Project' },
      },
      { id: 'client', header: 'Client', accessorFn: (row) => row.customer.name, enableSorting: true, cell: ({ row }) => <span className="block max-w-56 truncate">{row.original.customer.name}</span>, meta: { hideBelow: 'md' } },
      { id: 'manager', header: 'Manager', cell: ({ row }) => row.original.manager?.name ?? <span className="text-subtle-foreground">Unassigned</span>, meta: { hideBelow: 'lg' } },
      { id: 'status', header: 'Status', cell: ({ row }) => <StatusBadge status={row.original.status} /> },
      {
        id: 'progress',
        header: 'Progress',
        accessorFn: (row) => Number(row.progressPct),
        enableSorting: true,
        cell: ({ row }) => <ProgressBar value={row.original.progressPct} tone={projectProgressTone(row.original)} label={`${row.original.name} progress`} className="w-32" />,
        meta: { hideBelow: 'sm' },
      },
      { id: 'contract', header: 'Contract value', accessorFn: (row) => Number(row.contractAmount), enableSorting: true, cell: ({ row }) => <span className="font-medium">{formatPHP(row.original.contractAmount)}</span>, meta: { numeric: true, hideBelow: 'md' } },
      { id: 'end', header: 'Target finish', accessorFn: (row) => projectTargetFinish(row) ?? '', enableSorting: true, cell: ({ row }) => <TargetFinish project={row.original} />, meta: { hideBelow: 'lg' } },
    ],
    [],
  );
}

function NewProjectButton() {
  return (
    <Button asChild variant="primary">
      <Link href="/projects/new">
        <Plus className="size-3.5" aria-hidden />
        New project
      </Link>
    </Button>
  );
}

export function ProjectsView() {
  const router = useRouter();
  const canCreate = useCan('projects.project', 'CREATE');
  const [view, setView] = useListView();
  const list = useListState(INITIAL);
  const projects = useProjects(list.query);
  const page = projects.data;
  const columns = useProjectColumns();

  const filtering = Boolean(list.debounced) || list.activeCount > 0;
  const filters = (
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
  );
  const pagination: PaginationProps = {
    count: page?.items.length ?? 0,
    hasPrevious: list.paging.hasPrevious,
    hasNext: Boolean(page?.nextCursor),
    onPrevious: list.paging.goPrevious,
    onNext: () => list.paging.goNext(page?.nextCursor ?? null),
    loading: projects.isFetching,
  };
  const emptyState = (
    <EmptyState
      icon={FolderKanban}
      title={filtering ? 'No projects match these filters' : 'No projects yet'}
      description={
        filtering
          ? 'Clear the filters or search for a different name or code.'
          : 'Create the first project to set up its WBS, bill of quantities and budget, then start procuring against it.'
      }
      action={canCreate && !filtering ? <NewProjectButton /> : undefined}
    />
  );

  return (
    <PermissionGate module="projects.project">
      <PageHeader
        title="Projects"
        description="Every job the company is delivering, from tender to close-out."
        breadcrumbs={[{ label: 'Projects' }]}
        actions={
          <>
            <ViewToggle view={view} onChange={setView} />
            {canCreate ? <NewProjectButton /> : null}
          </>
        }
      />
      {view === 'table' ? (
        <DataTable
          caption="Projects"
          columns={columns}
          data={page?.items ?? []}
          getRowId={(row) => row.id}
          loading={projects.isPending}
          error={projects.error}
          onRetry={() => void projects.refetch()}
          onRowActivate={(row) => router.push(`/projects/${row.id}`)}
          toolbar={filters}
          pagination={pagination}
          emptyState={emptyState}
        />
      ) : (
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-surface px-3 py-2.5 shadow-card md:px-4">{filters}</div>
          {projects.error ? (
            <div className="rounded-xl border border-border bg-surface shadow-card">
              <QueryErrorState error={projects.error} onRetry={() => void projects.refetch()} compact />
            </div>
          ) : !projects.isPending && (page?.items.length ?? 0) === 0 ? (
            <div className="rounded-xl border border-border bg-surface shadow-card">{emptyState}</div>
          ) : (
            <ProjectCards projects={page?.items ?? []} loading={projects.isPending} />
          )}
          <Pagination {...pagination} />
        </div>
      )}
    </PermissionGate>
  );
}
