'use client';

import type { DataColumn } from '@/components/common/data-table/column-meta';
import { GitBranch, Plus } from 'lucide-react';
import * as React from 'react';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { DataTable } from '@/components/common/data-table/data-table';
import { EmptyState } from '@/components/common/empty-state';
import { PageHeader } from '@/components/common/page-header';
import { useCursorPagination } from '@/components/common/pagination';
import { SearchInput } from '@/components/common/search-input';
import { StatusBadge } from '@/components/common/status-badge';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';
import { PermissionGate } from '@/features/auth/components/permission-gate';
import { useCan } from '@/features/auth/components/current-user';
import type { BranchDto } from '@/lib/api/contract';
import { errorMessage } from '@/lib/api/errors';
import { formatDate } from '@/lib/format';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { useBranches, useUpdateBranch } from '../api/hooks';
import { BranchDialog } from './branch-dialog';

const PAGE_SIZE = 25;

export function BranchesView() {
  const canCreate = useCan('organization.branch', 'CREATE');
  const canEdit = useCan('organization.branch', 'EDIT');
  const [search, setSearch] = React.useState('');
  const debounced = useDebouncedValue(search.trim(), 300);
  const paging = useCursorPagination();
  const { reset } = paging;
  const filters = {
    limit: PAGE_SIZE,
    ...(debounced ? { search: debounced } : {}),
    ...(paging.cursor ? { cursor: paging.cursor } : {}),
  };
  const branches = useBranches(filters);
  const updateBranch = useUpdateBranch();
  const [editing, setEditing] = React.useState<BranchDto | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [toggling, setToggling] = React.useState<BranchDto | null>(null);

  React.useEffect(() => reset(), [debounced, reset]);

  function openDialog(branch: BranchDto | null): void {
    setEditing(branch);
    setDialogOpen(true);
  }

  function confirmToggle(): void {
    if (!toggling) return;
    const next = !toggling.active;
    updateBranch.mutate(
      { id: toggling.id, body: { active: next } },
      {
        onSuccess: () => {
          toast.success(next ? 'Branch reactivated' : 'Branch deactivated');
          setToggling(null);
        },
        onError: (error) => toast.error('Could not update the branch', errorMessage(error)),
      },
    );
  }

  const columns = React.useMemo<DataColumn<BranchDto>[]>(
    () => [
      {
        id: 'code',
        header: 'Code',
        enableSorting: true,
        accessorFn: (branch) => branch.code,
        cell: ({ row }) => (
          <span className="font-mono text-xs font-medium">{row.original.code}</span>
        ),
        meta: { sticky: true },
      },
      {
        id: 'name',
        header: 'Name',
        enableSorting: true,
        accessorFn: (branch) => branch.name,
        cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
      },
      {
        id: 'address',
        header: 'Address',
        cell: ({ row }) => (
          <span className="text-muted-foreground">{row.original.address ?? '—'}</span>
        ),
        meta: { hideBelow: 'md' },
      },
      {
        id: 'status',
        header: 'Status',
        cell: ({ row }) => <StatusBadge status={row.original.active ? 'ACTIVE' : 'INACTIVE'} />,
      },
      {
        id: 'updated',
        header: 'Updated',
        accessorFn: (branch) => branch.updatedAt,
        enableSorting: true,
        cell: ({ row }) => formatDate(row.original.updatedAt),
        meta: { hideBelow: 'lg' },
      },
      {
        id: 'actions',
        header: () => <span className="sr-only">Actions</span>,
        enableHiding: false,
        meta: { numeric: true },
        cell: ({ row }) =>
          canEdit ? (
            <div className="flex justify-end gap-1.5">
              <Button size="sm" onClick={() => openDialog(row.original)}>
                Edit
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setToggling(row.original)}>
                {row.original.active ? 'Deactivate' : 'Reactivate'}
              </Button>
            </div>
          ) : null,
      },
    ],
    [canEdit],
  );

  const page = branches.data;
  return (
    <PermissionGate module="organization.branch">
      <PageHeader
        title="Branches"
        description="Offices and regional units. Warehouses, projects and staff belong to a branch."
        breadcrumbs={[{ label: 'Administration' }, { label: 'Branches' }]}
        actions={
          canCreate ? (
            <Button variant="primary" onClick={() => openDialog(null)}>
              <Plus className="size-3.5" aria-hidden />
              New branch
            </Button>
          ) : null
        }
      />
      <DataTable
        caption="Branches"
        columns={columns}
        data={page?.items ?? []}
        getRowId={(branch) => branch.id}
        loading={branches.isPending}
        error={branches.error}
        onRetry={() => void branches.refetch()}
        toolbar={
          <SearchInput
            value={search}
            onValueChange={setSearch}
            placeholder="Search branches by name"
          />
        }
        pagination={{
          count: page?.items.length ?? 0,
          hasPrevious: paging.hasPrevious,
          hasNext: Boolean(page?.nextCursor),
          onPrevious: paging.goPrevious,
          onNext: () => paging.goNext(page?.nextCursor ?? null),
          loading: branches.isFetching,
        }}
        emptyState={
          <EmptyState
            icon={GitBranch}
            title={debounced ? 'No branches match that search' : 'No branches yet'}
            description={
              debounced
                ? 'Try a different name or clear the search.'
                : 'Create a branch for each office so warehouses, projects and staff can be grouped under it.'
            }
            action={
              canCreate && !debounced ? (
                <Button variant="primary" onClick={() => openDialog(null)}>
                  <Plus className="size-3.5" aria-hidden />
                  New branch
                </Button>
              ) : undefined
            }
          />
        }
      />
      <BranchDialog open={dialogOpen} onOpenChange={setDialogOpen} branch={editing} />
      <ConfirmDialog
        open={toggling !== null}
        onOpenChange={(open) => (open ? undefined : setToggling(null))}
        title={
          toggling?.active ? `Deactivate ${toggling.name}?` : `Reactivate ${toggling?.name ?? ''}?`
        }
        description={
          toggling?.active
            ? 'The branch stays on existing records but can no longer be chosen for new ones. You can reactivate it later.'
            : 'The branch becomes available for new records again.'
        }
        confirmLabel={toggling?.active ? 'Deactivate' : 'Reactivate'}
        tone={toggling?.active ? 'danger' : 'primary'}
        loading={updateBranch.isPending}
        onConfirm={confirmToggle}
      />
    </PermissionGate>
  );
}
