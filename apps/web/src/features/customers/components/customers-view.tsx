'use client';

import { Contact as ContactIcon, Plus } from 'lucide-react';
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
import type { Customer } from '@/lib/api/types';
import { formatPHP } from '@/lib/format';
import { useListState } from '@/lib/list-state';
import { useCustomers } from '../api/hooks';
import { CustomerDrawer } from './customer-form';

const INITIAL = { active: 'true' } as Record<string, string>;

export function CustomersView() {
  const router = useRouter();
  const canCreate = useCan('parties.customer', 'CREATE');
  const list = useListState(INITIAL);
  const customers = useCustomers(list.query);
  const [open, setOpen] = React.useState(false);
  const page = customers.data;

  const columns = React.useMemo<DataColumn<Customer>[]>(
    () => [
      {
        id: 'code',
        header: 'Code',
        enableSorting: true,
        accessorFn: (row) => row.code,
        cell: ({ row }) => (
          <Link href={`/customers/${row.original.id}`} className="doc-link">
            {row.original.code}
          </Link>
        ),
        meta: { sticky: true },
      },
      {
        id: 'name',
        header: 'Customer',
        enableSorting: true,
        accessorFn: (row) => row.name,
        cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
      },
      {
        id: 'contact',
        header: 'Contact',
        cell: ({ row }) => (
          <span className="text-muted-foreground">{row.original.email ?? row.original.phone ?? '—'}</span>
        ),
        meta: { hideBelow: 'md' },
      },
      {
        id: 'terms',
        header: 'Terms',
        accessorFn: (row) => row.paymentTermsDays,
        cell: ({ row }) => (row.original.paymentTermsDays === 0 ? 'Cash' : `Net ${row.original.paymentTermsDays}`),
        meta: { numeric: true, hideBelow: 'lg' },
      },
      {
        id: 'credit',
        header: 'Credit limit',
        accessorFn: (row) => Number(row.creditLimit),
        enableSorting: true,
        cell: ({ row }) => formatPHP(row.original.creditLimit),
        meta: { numeric: true, hideBelow: 'lg' },
      },
      {
        id: 'status',
        header: 'Status',
        cell: ({ row }) => <StatusBadge status={row.original.active ? 'ACTIVE' : 'INACTIVE'} />,
      },
    ],
    [],
  );

  const filtering = Boolean(list.debounced) || list.activeCount > 0;
  return (
    <PermissionGate module="parties.customer">
      <PageHeader
        title="Customers"
        description="The clients your projects are contracted with."
        breadcrumbs={[{ label: 'Projects' }, { label: 'Customers' }]}
        actions={
          canCreate ? (
            <Button variant="primary" onClick={() => setOpen(true)}>
              <Plus className="size-3.5" aria-hidden />
              New customer
            </Button>
          ) : null
        }
      />
      <DataTable
        caption="Customers"
        columns={columns}
        data={page?.items ?? []}
        getRowId={(row) => row.id}
        loading={customers.isPending}
        error={customers.error}
        onRetry={() => void customers.refetch()}
        onRowActivate={(row) => router.push(`/customers/${row.id}`)}
        toolbar={
          <FilterBar activeCount={list.activeCount} onReset={list.clearFilters}>
            <SearchInput value={list.search} onValueChange={list.setSearch} placeholder="Search by name or code" />
            <div className="w-32">
              <Select
                aria-label="Status"
                value={list.filters.active ?? ''}
                onChange={(event) => list.setFilter('active', event.target.value)}
              >
                <option value="true">Active</option>
                <option value="false">Inactive</option>
                <option value="">All</option>
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
          loading: customers.isFetching,
        }}
        emptyState={
          <EmptyState
            icon={ContactIcon}
            title={filtering ? 'No customers match these filters' : 'No customers yet'}
            description={
              filtering
                ? 'Clear the filters or search for a different name.'
                : 'Add the client first, then create their project.'
            }
            action={
              canCreate && !filtering ? (
                <Button variant="primary" onClick={() => setOpen(true)}>
                  <Plus className="size-3.5" aria-hidden />
                  New customer
                </Button>
              ) : undefined
            }
          />
        }
      />
      <CustomerDrawer open={open} onOpenChange={setOpen} customer={null} navigateOnCreate />
    </PermissionGate>
  );
}
