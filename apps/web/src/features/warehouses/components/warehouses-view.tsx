'use client';

import { Plus, Warehouse as WarehouseIcon } from 'lucide-react';
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
import type { WarehouseRow } from '@/lib/api/types';
import { titleCase } from '@/lib/format';
import { useListState } from '@/lib/list-state';
import { useWarehouses } from '../api/hooks';
import { WarehouseDrawer } from './warehouse-form';

export function WarehousesView() {
  const router = useRouter();
  const canCreate = useCan('organization.warehouse', 'CREATE');
  const list = useListState({ status: 'active' } as Record<string, string>);
  const warehouses = useWarehouses({
    limit: list.query.limit as number,
    ...(list.query.search ? { search: list.query.search } : {}),
    ...(list.query.cursor ? { cursor: list.query.cursor } : {}),
  });
  const [open, setOpen] = React.useState(false);
  const page = warehouses.data;
  const rows = React.useMemo(
    () =>
      (page?.items ?? []).filter((row) =>
        list.filters.status === 'active' ? row.active : list.filters.status === 'inactive' ? !row.active : true,
      ),
    [page, list.filters.status],
  );

  const columns = React.useMemo<DataColumn<WarehouseRow>[]>(
    () => [
      {
        id: 'code',
        header: 'Code',
        enableSorting: true,
        accessorFn: (row) => row.code,
        cell: ({ row }) => (
          <Link href={`/inventory/warehouses/${row.original.id}`} className="font-mono text-xs font-medium text-primary hover:underline">
            {row.original.code}
          </Link>
        ),
        meta: { sticky: true },
      },
      { id: 'name', header: 'Warehouse', enableSorting: true, accessorFn: (row) => row.name, cell: ({ row }) => <span className="font-medium">{row.original.name}</span> },
      { id: 'type', header: 'Type', cell: ({ row }) => titleCase(row.original.type), meta: { hideBelow: 'sm' } },
      {
        id: 'project',
        header: 'Project',
        cell: ({ row }) =>
          row.original.project ? (
            <Link href={`/projects/${row.original.project.id}`} className="hover:underline">
              {row.original.project.name}
            </Link>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
        meta: { hideBelow: 'md' },
      },
      { id: 'branch', header: 'Branch', cell: ({ row }) => row.original.branch?.name ?? '—', meta: { hideBelow: 'md' } },
      { id: 'status', header: 'Status', cell: ({ row }) => <StatusBadge status={row.original.active ? 'ACTIVE' : 'INACTIVE'} /> },
    ],
    [],
  );

  const filtering = Boolean(list.debounced) || list.filters.status !== 'active';
  return (
    <PermissionGate module="organization.warehouse">
      <PageHeader
        title="Warehouses"
        description="Central stores, regional yards and project sites where stock is held."
        breadcrumbs={[{ label: 'Inventory' }, { label: 'Warehouses' }]}
        actions={
          canCreate ? (
            <Button variant="primary" onClick={() => setOpen(true)}>
              <Plus className="size-3.5" aria-hidden />
              New warehouse
            </Button>
          ) : null
        }
      />
      <DataTable
        caption="Warehouses"
        columns={columns}
        data={rows}
        getRowId={(row) => row.id}
        loading={warehouses.isPending}
        error={warehouses.error}
        onRetry={() => void warehouses.refetch()}
        onRowActivate={(row) => router.push(`/inventory/warehouses/${row.id}`)}
        toolbar={
          <FilterBar activeCount={list.activeCount} onReset={list.clearFilters}>
            <SearchInput value={list.search} onValueChange={list.setSearch} placeholder="Search by name or code" />
            <div className="w-32">
              <Select aria-label="Status" value={list.filters.status ?? ''} onChange={(event) => list.setFilter('status', event.target.value)}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="">All</option>
              </Select>
            </div>
          </FilterBar>
        }
        pagination={{
          count: rows.length,
          hasPrevious: list.paging.hasPrevious,
          hasNext: Boolean(page?.nextCursor),
          onPrevious: list.paging.goPrevious,
          onNext: () => list.paging.goNext(page?.nextCursor ?? null),
          loading: warehouses.isFetching,
        }}
        emptyState={
          <EmptyState
            icon={WarehouseIcon}
            title={filtering ? 'No warehouses match' : 'No warehouses yet'}
            description={
              filtering
                ? 'Clear the search or show inactive warehouses.'
                : 'Create the stores and site yards where materials will be received and issued.'
            }
            action={
              canCreate && !filtering ? (
                <Button variant="primary" onClick={() => setOpen(true)}>
                  <Plus className="size-3.5" aria-hidden />
                  New warehouse
                </Button>
              ) : undefined
            }
          />
        }
      />
      <WarehouseDrawer open={open} onOpenChange={setOpen} warehouse={null} navigateOnCreate />
    </PermissionGate>
  );
}
