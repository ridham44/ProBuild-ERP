'use client';

import { COST_CATEGORY_KEYS, createCostCodeSchema } from '@probuild/shared';
import { Hash, Pencil, Plus } from 'lucide-react';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import type { DataColumn } from '@/components/common/data-table/column-meta';
import { DataTable } from '@/components/common/data-table/data-table';
import { EmptyState } from '@/components/common/empty-state';
import { FilterBar } from '@/components/common/filter-bar';
import { SelectField, TextField } from '@/components/common/form-controls';
import { PageHeader } from '@/components/common/page-header';
import { SearchInput } from '@/components/common/search-input';
import { StatusBadge } from '@/components/common/status-badge';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Select } from '@/components/ui/select';
import { toast } from '@/components/ui/toast';
import { useCan } from '@/features/auth/components/current-user';
import { PermissionGate } from '@/features/auth/components/permission-gate';
import { errorMessage } from '@/lib/api/errors';
import type { CostCode } from '@/lib/api/types';
import { applyServerErrors, formResolver, withClearedFields } from '@/lib/forms';
import { titleCase } from '@/lib/format';
import { useListState } from '@/lib/list-state';
import { useCostCodes, useCreateCostCode, useUpdateCostCode } from '../api/hooks';

type FormValues = z.input<typeof createCostCodeSchema>;
const FIELDS = ['code', 'name', 'category', 'parentId'] as const;
const INITIAL = { category: '', active: 'true' } as Record<string, string>;

function CostCodeDialog({
  open,
  onOpenChange,
  code,
  parents,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  code: CostCode | null;
  parents: CostCode[];
}) {
  const create = useCreateCostCode();
  const update = useUpdateCostCode();
  const [formError, setFormError] = React.useState<string | null>(null);
  const pending = create.isPending || update.isPending;
  const initial = React.useMemo<FormValues>(
    () => ({ code: code?.code ?? '', name: code?.name ?? '', category: code?.category ?? 'MATERIAL', parentId: code?.parentId ?? '' }),
    [code],
  );
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: formResolver<FormValues>(createCostCodeSchema), defaultValues: initial });
  React.useEffect(() => {
    if (open) {
      reset(initial);
      setFormError(null);
    }
  }, [open, initial, reset]);

  function submit(values: FormValues): void {
    setFormError(null);
    const callbacks = {
      onSuccess: () => {
        toast.success(code ? 'Cost code updated' : 'Cost code created');
        onOpenChange(false);
      },
      onError: (error: unknown) => setFormError(applyServerErrors(error, setError, FIELDS)),
    };
    if (code) update.mutate({ id: code.id, body: withClearedFields(initial, values, ['parentId']) }, callbacks);
    else create.mutate(values, callbacks);
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (pending ? undefined : onOpenChange(next))}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>{code ? `Edit ${code.code}` : 'New cost code'}</DialogTitle>
          <DialogDescription>Cost codes classify spending so budgets and actuals can be compared.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(submit)} noValidate className="flex min-h-0 flex-1 flex-col">
          <DialogBody className="space-y-3">
            {formError ? <Alert tone="danger">{formError}</Alert> : null}
            <TextField label="Code" required autoFocus inputClassName="font-mono" error={errors.code?.message} {...register('code')} />
            <TextField label="Name" required error={errors.name?.message} {...register('name')} />
            <SelectField label="Category" error={errors.category?.message} {...register('category')}>
              {COST_CATEGORY_KEYS.map((key) => (
                <option key={key} value={key}>
                  {titleCase(key)}
                </option>
              ))}
            </SelectField>
            <SelectField label="Parent code" error={errors.parentId?.message} {...register('parentId')}>
              <option value="">Top level</option>
              {parents
                .filter((parent) => parent.id !== code?.id)
                .map((parent) => (
                  <option key={parent.id} value={parent.id}>
                    {parent.code} {parent.name}
                  </option>
                ))}
            </SelectField>
          </DialogBody>
          <DialogFooter>
            <Button onClick={() => onOpenChange(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={pending}>
              {code ? 'Save' : 'Create cost code'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function CostCodesView() {
  const canCreate = useCan('projects.costcode', 'CREATE');
  const canEdit = useCan('projects.costcode', 'EDIT');
  const list = useListState(INITIAL, 50);
  const codes = useCostCodes(list.query);
  const parentChoices = useCostCodes({ limit: 100, active: 'true' });
  const update = useUpdateCostCode();
  const [dialog, setDialog] = React.useState<{ code: CostCode | null } | null>(null);
  const page = codes.data;
  const parentName = React.useMemo(
    () => new Map((parentChoices.data?.items ?? []).map((entry) => [entry.id, `${entry.code}`])),
    [parentChoices.data],
  );

  const columns = React.useMemo<DataColumn<CostCode>[]>(
    () => [
      {
        id: 'code',
        header: 'Code',
        enableSorting: true,
        accessorFn: (row) => row.code,
        cell: ({ row }) => <span className="font-mono text-xs font-medium">{row.original.code}</span>,
        meta: { sticky: true },
      },
      { id: 'name', header: 'Name', enableSorting: true, accessorFn: (row) => row.name, cell: ({ row }) => <span className="font-medium">{row.original.name}</span> },
      { id: 'category', header: 'Category', cell: ({ row }) => <Badge>{titleCase(row.original.category)}</Badge> },
      {
        id: 'parent',
        header: 'Parent',
        cell: ({ row }) => (row.original.parentId ? <span className="font-mono text-xs">{parentName.get(row.original.parentId) ?? '…'}</span> : '—'),
        meta: { hideBelow: 'md' },
      },
      { id: 'status', header: 'Status', cell: ({ row }) => <StatusBadge status={row.original.active ? 'ACTIVE' : 'INACTIVE'} /> },
      {
        id: 'actions',
        header: () => <span className="sr-only">Actions</span>,
        enableHiding: false,
        meta: { numeric: true },
        cell: ({ row }) =>
          canEdit ? (
            <div className="flex justify-end gap-1.5">
              <Button size="sm" onClick={() => setDialog({ code: row.original })}>
                <Pencil className="size-3.5" aria-hidden />
                Edit
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  update.mutate(
                    { id: row.original.id, body: { active: !row.original.active } },
                    {
                      onSuccess: () => toast.success(row.original.active ? 'Cost code deactivated' : 'Cost code reactivated'),
                      onError: (error) => toast.error('Could not update the cost code', errorMessage(error)),
                    },
                  )
                }
              >
                {row.original.active ? 'Deactivate' : 'Reactivate'}
              </Button>
            </div>
          ) : null,
      },
    ],
    [canEdit, parentName, update],
  );

  const filtering = Boolean(list.debounced) || list.activeCount > 0;
  return (
    <PermissionGate module="projects.costcode">
      <PageHeader
        title="Cost codes"
        description="The chart of cost classifications used on BOQ items, requisition lines and budgets."
        breadcrumbs={[{ label: 'Projects' }, { label: 'Cost codes' }]}
        actions={
          canCreate ? (
            <Button variant="primary" onClick={() => setDialog({ code: null })}>
              <Plus className="size-3.5" aria-hidden />
              New cost code
            </Button>
          ) : null
        }
      />
      <DataTable
        caption="Cost codes"
        columns={columns}
        data={page?.items ?? []}
        getRowId={(row) => row.id}
        loading={codes.isPending}
        error={codes.error}
        onRetry={() => void codes.refetch()}
        toolbar={
          <FilterBar activeCount={list.activeCount} onReset={list.clearFilters}>
            <SearchInput value={list.search} onValueChange={list.setSearch} placeholder="Search code or name" />
            <div className="w-40">
              <Select aria-label="Category" value={list.filters.category ?? ''} onChange={(event) => list.setFilter('category', event.target.value)}>
                <option value="">All categories</option>
                {COST_CATEGORY_KEYS.map((key) => (
                  <option key={key} value={key}>
                    {titleCase(key)}
                  </option>
                ))}
              </Select>
            </div>
            <div className="w-28">
              <Select aria-label="Status" value={list.filters.active ?? ''} onChange={(event) => list.setFilter('active', event.target.value)}>
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
          loading: codes.isFetching,
        }}
        emptyState={
          <EmptyState
            icon={Hash}
            title={filtering ? 'No cost codes match these filters' : 'No cost codes yet'}
            description={
              filtering
                ? 'Clear the filters or search for a different code.'
                : 'Create codes for material, labor, equipment and subcontract spending so costs can be tracked against the budget.'
            }
            action={
              canCreate && !filtering ? (
                <Button variant="primary" onClick={() => setDialog({ code: null })}>
                  <Plus className="size-3.5" aria-hidden />
                  New cost code
                </Button>
              ) : undefined
            }
          />
        }
      />
      <CostCodeDialog
        open={dialog !== null}
        onOpenChange={(open) => (open ? undefined : setDialog(null))}
        code={dialog?.code ?? null}
        parents={parentChoices.data?.items ?? []}
      />
    </PermissionGate>
  );
}
