'use client';

import { Plus, Truck } from 'lucide-react';
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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { useCan } from '@/features/auth/components/current-user';
import { PermissionGate } from '@/features/auth/components/permission-gate';
import type { Supplier } from '@/lib/api/types';
import { formatDate } from '@/lib/format';
import { useListState } from '@/lib/list-state';
import { useSuppliers } from '../api/hooks';
import { SupplierDrawer } from './supplier-form';

const INITIAL = { active: 'true', accredited: '', category: '' } as Record<string, string>;

export function AccreditationBadge({ supplier }: { supplier: Pick<Supplier, 'accredited' | 'accreditationExpiry'> }) {
  if (!supplier.accredited) return <Badge>Not accredited</Badge>;
  const expired =
    supplier.accreditationExpiry !== null && new Date(supplier.accreditationExpiry) < new Date();
  return expired ? (
    <Badge tone="overdue">Accreditation expired</Badge>
  ) : (
    <Badge tone="approved">Accredited</Badge>
  );
}

export function SuppliersView() {
  const router = useRouter();
  const canCreate = useCan('parties.supplier', 'CREATE');
  const list = useListState(INITIAL);
  const suppliers = useSuppliers(list.query);
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const page = suppliers.data;

  const columns = React.useMemo<DataColumn<Supplier>[]>(
    () => [
      {
        id: 'code',
        header: 'Code',
        enableSorting: true,
        accessorFn: (supplier) => supplier.code,
        cell: ({ row }) => (
          <Link
            href={`/procurement/suppliers/${row.original.id}`}
            className="doc-link"
          >
            {row.original.code}
          </Link>
        ),
        meta: { sticky: true },
      },
      {
        id: 'name',
        header: 'Supplier',
        enableSorting: true,
        accessorFn: (supplier) => supplier.name,
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="font-medium">{row.original.name}</p>
            {row.original.productCategories ? (
              <p className="max-w-72 truncate text-xs text-muted-foreground">
                {row.original.productCategories}
              </p>
            ) : null}
          </div>
        ),
      },
      {
        id: 'category',
        header: 'Category',
        accessorFn: (supplier) => supplier.category ?? '',
        enableSorting: true,
        cell: ({ row }) => row.original.category ?? '—',
        meta: { hideBelow: 'md' },
      },
      {
        id: 'accreditation',
        header: 'Accreditation',
        cell: ({ row }) => <AccreditationBadge supplier={row.original} />,
        meta: { hideBelow: 'sm' },
      },
      {
        id: 'terms',
        header: 'Terms',
        accessorFn: (supplier) => supplier.paymentTermsDays,
        enableSorting: true,
        cell: ({ row }) =>
          row.original.paymentTermsDays === 0 ? 'Cash' : `Net ${row.original.paymentTermsDays}`,
        meta: { numeric: true, hideBelow: 'lg' },
      },
      {
        id: 'contact',
        header: 'Contact',
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {row.original.email ?? row.original.phone ?? '—'}
          </span>
        ),
        meta: { hideBelow: 'lg' },
      },
      {
        id: 'status',
        header: 'Status',
        cell: ({ row }) => <StatusBadge status={row.original.active ? 'ACTIVE' : 'INACTIVE'} />,
      },
      {
        id: 'updated',
        header: 'Updated',
        accessorFn: (supplier) => supplier.updatedAt,
        enableSorting: true,
        cell: ({ row }) => formatDate(row.original.updatedAt),
        meta: { hideBelow: 'lg' },
      },
    ],
    [],
  );

  const filtering = Boolean(list.debounced) || list.activeCount > 0;
  return (
    <PermissionGate module="parties.supplier">
      <PageHeader
        title="Suppliers"
        description="Approved vendors, their terms and track record. Accredited suppliers are preferred for RFQs."
        breadcrumbs={[{ label: 'Procurement' }, { label: 'Suppliers' }]}
        actions={
          canCreate ? (
            <Button variant="primary" onClick={() => setDrawerOpen(true)}>
              <Plus className="size-3.5" aria-hidden />
              New supplier
            </Button>
          ) : null
        }
      />
      <DataTable
        caption="Suppliers"
        columns={columns}
        data={page?.items ?? []}
        getRowId={(supplier) => supplier.id}
        loading={suppliers.isPending}
        error={suppliers.error}
        onRetry={() => void suppliers.refetch()}
        onRowActivate={(supplier) => router.push(`/procurement/suppliers/${supplier.id}`)}
        initialVisibility={{ updated: false }}
        toolbar={
          <FilterBar activeCount={list.activeCount} onReset={list.clearFilters}>
            <SearchInput
              value={list.search}
              onValueChange={list.setSearch}
              placeholder="Search by name or code"
            />
            <div className="w-36">
              <Select
                aria-label="Accreditation"
                value={list.filters.accredited ?? ''}
                onChange={(event) => list.setFilter('accredited', event.target.value)}
              >
                <option value="">Any accreditation</option>
                <option value="true">Accredited</option>
                <option value="false">Not accredited</option>
              </Select>
            </div>
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
            <div className="w-40">
              <SearchInput
                value={list.filters.category ?? ''}
                onValueChange={(value) => list.setFilter('category', value)}
                placeholder="Category"
                aria-label="Category"
                wrapperClassName="sm:w-40"
              />
            </div>
          </FilterBar>
        }
        pagination={{
          count: page?.items.length ?? 0,
          hasPrevious: list.paging.hasPrevious,
          hasNext: Boolean(page?.nextCursor),
          onPrevious: list.paging.goPrevious,
          onNext: () => list.paging.goNext(page?.nextCursor ?? null),
          loading: suppliers.isFetching,
        }}
        emptyState={
          <EmptyState
            icon={Truck}
            title={filtering ? 'No suppliers match these filters' : 'No suppliers yet'}
            description={
              filtering
                ? 'Clear the filters or search for a different name.'
                : 'Add the vendors you buy from. Their terms, contacts and accreditation feed every RFQ and purchase order.'
            }
            action={
              canCreate && !filtering ? (
                <Button variant="primary" onClick={() => setDrawerOpen(true)}>
                  <Plus className="size-3.5" aria-hidden />
                  New supplier
                </Button>
              ) : undefined
            }
          />
        }
      />
      <SupplierDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        supplier={null}
        navigateOnCreate
      />
    </PermissionGate>
  );
}
