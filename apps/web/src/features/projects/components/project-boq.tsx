'use client';

import { COST_CATEGORY_KEYS, createBoqItemSchema } from '@probuild/shared';
import { CheckCircle2, ListChecks, Pencil, Plus, Trash2 } from 'lucide-react';
import * as React from 'react';
import { Controller, useForm } from 'react-hook-form';
import type { z } from 'zod';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import type { DataColumn } from '@/components/common/data-table/column-meta';
import { DataTable } from '@/components/common/data-table/data-table';
import { EmptyState } from '@/components/common/empty-state';
import { EntityCombobox } from '@/components/common/entity-combobox';
import { SelectField, TextField } from '@/components/common/form-controls';
import { FormField } from '@/components/common/form-field';
import { Panel } from '@/components/common/panel';
import { useCursorPagination } from '@/components/common/pagination';
import { StatusBadge } from '@/components/common/status-badge';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button, IconButton } from '@/components/ui/button';
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
import { errorMessage } from '@/lib/api/errors';
import type { BoqRow, EstimateRow, ProjectDetail } from '@/lib/api/types';
import { mulDecimal } from '@/lib/decimal';
import { applyServerErrors, formResolver, withClearedFields } from '@/lib/forms';
import { formatDate, formatPHP, formatQty, titleCase } from '@/lib/format';
import {
  searchCostCodeOptions,
  useAddBoqItem,
  useApproveEstimate,
  useBoq,
  useCreateEstimate,
  useDeleteBoqItem,
  useEstimates,
  useUpdateBoqItem,
  useWbs,
} from '../api/hooks';

type ItemValues = z.input<typeof createBoqItemSchema>;
const FIELDS = ['section', 'itemNo', 'description', 'costCategory', 'unit', 'quantity', 'unitRate', 'wbsNodeId', 'costCodeId'] as const;

function ItemDialog({
  open,
  onOpenChange,
  project,
  estimate,
  item,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: ProjectDetail;
  estimate: EstimateRow;
  item: BoqRow | null;
}) {
  const add = useAddBoqItem(project.id, estimate.id);
  const update = useUpdateBoqItem(project.id);
  const wbs = useWbs(project.id, open);
  const [formError, setFormError] = React.useState<string | null>(null);
  const pending = add.isPending || update.isPending;
  const initial = React.useMemo<ItemValues>(
    () => ({
      section: item?.section ?? '',
      itemNo: item?.itemNo ?? '',
      description: item?.description ?? '',
      costCategory: (item?.costCategory as ItemValues['costCategory']) ?? 'MATERIAL',
      unit: item?.unit ?? '',
      quantity: item?.quantity ?? '',
      unitRate: item?.unitRate ?? '',
      wbsNodeId: item?.wbsNodeId ?? '',
      costCodeId: item?.costCodeId ?? '',
    }),
    [item],
  );
  const {
    register,
    control,
    handleSubmit,
    setError,
    reset,
    watch,
    formState: { errors },
  } = useForm<ItemValues>({ resolver: formResolver<ItemValues>(createBoqItemSchema), defaultValues: initial });
  React.useEffect(() => {
    if (open) {
      reset(initial);
      setFormError(null);
    }
  }, [open, initial, reset]);
  const [quantity, unitRate] = watch(['quantity', 'unitRate']);

  function submit(values: ItemValues): void {
    setFormError(null);
    const callbacks = {
      onSuccess: () => {
        toast.success(item ? 'BOQ item updated' : 'BOQ item added');
        onOpenChange(false);
      },
      onError: (error: unknown) => setFormError(applyServerErrors(error, setError, FIELDS)),
    };
    if (item) {
      update.mutate({ id: item.id, body: withClearedFields(initial, values, ['section', 'wbsNodeId', 'costCodeId']) }, callbacks);
    } else add.mutate(values, callbacks);
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (pending ? undefined : onOpenChange(next))}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{item ? `Edit item ${item.itemNo}` : 'Add BOQ item'}</DialogTitle>
          <DialogDescription>
            Estimate version {estimate.version}. Amount is quantity times unit rate.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(submit)} noValidate className="flex min-h-0 flex-1 flex-col">
          <DialogBody className="space-y-3">
            {formError ? <Alert tone="danger">{formError}</Alert> : null}
            <div className="grid gap-3 sm:grid-cols-[8rem_1fr]">
              <TextField label="Item no." required autoFocus inputClassName="font-mono" error={errors.itemNo?.message} {...register('itemNo')} />
              <TextField label="Description" required error={errors.description?.message} {...register('description')} />
            </div>
            <div className="grid gap-3 sm:grid-cols-4">
              <TextField label="Section" error={errors.section?.message} {...register('section')} />
              <SelectField label="Cost category" error={errors.costCategory?.message} {...register('costCategory')}>
                {COST_CATEGORY_KEYS.map((key) => (
                  <option key={key} value={key}>
                    {titleCase(key)}
                  </option>
                ))}
              </SelectField>
              <TextField label="Unit" required error={errors.unit?.message} {...register('unit')} />
              <div className="flex flex-col justify-end pb-1 text-right">
                <p className="text-xs text-muted-foreground">Amount</p>
                <p className="num text-base font-semibold">{formatPHP(mulDecimal(quantity || '0', unitRate || '0'))}</p>
              </div>
              <TextField label="Quantity" required inputMode="decimal" error={errors.quantity?.message} {...register('quantity')} />
              <TextField label="Unit rate (PHP)" required inputMode="decimal" error={errors.unitRate?.message} {...register('unitRate')} />
              <SelectField label="WBS node" error={errors.wbsNodeId?.message} {...register('wbsNodeId')}>
                <option value="">Unassigned</option>
                {(wbs.data ?? []).map((node) => (
                  <option key={node.id} value={node.id}>
                    {`${'  '.repeat(node.depth)}${node.code} ${node.name}`}
                  </option>
                ))}
              </SelectField>
              <FormField label="Cost code" error={errors.costCodeId?.message}>
                {(field) => (
                  <Controller
                    control={control}
                    name="costCodeId"
                    render={({ field: bound }) => (
                      <EntityCombobox
                        entity="cost-codes"
                        id={field.id}
                        search={searchCostCodeOptions}
                        value={bound.value || null}
                        {...(item?.costCode ? { selectedLabel: `${item.costCode.code} ${item.costCode.name}` } : {})}
                        onChange={(value) => bound.onChange(value ?? '')}
                        placeholder="None"
                        aria-invalid={field['aria-invalid']}
                        aria-describedby={field['aria-describedby']}
                      />
                    )}
                  />
                )}
              </FormField>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button onClick={() => onOpenChange(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={pending}>
              {item ? 'Save item' : 'Add item'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Estimates({
  project,
  estimates,
  selectedId,
  onSelect,
}: {
  project: ProjectDetail;
  estimates: EstimateRow[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const canCreate = useCan('projects.estimate', 'CREATE', { projectId: project.id });
  const canApprove = useCan('projects.estimate', 'APPROVE', { projectId: project.id });
  const create = useCreateEstimate(project.id);
  const approve = useApproveEstimate(project.id);
  const [approving, setApproving] = React.useState<EstimateRow | null>(null);

  return (
    <Panel
      title="Estimate versions"
      description="Only a draft can be edited. Approving an estimate creates the project budget from its items."
      bodyClassName="p-0"
      actions={
        canCreate ? (
          <Button
            size="sm"
            loading={create.isPending}
            onClick={() =>
              create.mutate(
                { type: 'DETAILED' },
                {
                  onSuccess: (created) => {
                    toast.success(`Estimate version ${created.version} created`);
                    onSelect(created.id);
                  },
                  onError: (error) => toast.error('Could not create the estimate', errorMessage(error)),
                },
              )
            }
          >
            <Plus className="size-3.5" aria-hidden />
            New version
          </Button>
        ) : null
      }
    >
      {estimates.length === 0 ? (
        <EmptyState
          compact
          icon={ListChecks}
          title="No estimates yet"
          description="Start an estimate, add the bill of quantities, then approve it to set the project budget."
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-2 font-medium">Version</th>
                <th className="px-3 py-2 font-medium">Type</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 text-right font-medium">Items</th>
                <th className="px-3 py-2 text-right font-medium">Direct cost</th>
                <th className="px-3 py-2 text-right font-medium">Total</th>
                <th className="px-3 py-2 font-medium">Approved</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {estimates.map((estimate) => (
                <tr
                  key={estimate.id}
                  className={`border-b border-border last:border-0 ${estimate.id === selectedId ? 'bg-primary-subtle/50' : ''}`}
                >
                  <td className="px-4 py-2">
                    <button type="button" onClick={() => onSelect(estimate.id)} className="font-medium text-primary hover:underline">
                      v{estimate.version}
                    </button>
                    {estimate.name ? <span className="ml-2 text-muted-foreground">{estimate.name}</span> : null}
                  </td>
                  <td className="px-3 py-2">{titleCase(estimate.type)}</td>
                  <td className="px-3 py-2">
                    <StatusBadge status={estimate.status} />
                  </td>
                  <td className="num px-3 py-2 text-right">{estimate._count.items}</td>
                  <td className="num px-3 py-2 text-right">{formatPHP(estimate.directCost)}</td>
                  <td className="num px-3 py-2 text-right font-medium">{formatPHP(estimate.totalAmount)}</td>
                  <td className="px-3 py-2 text-muted-foreground">{formatDate(estimate.approvedAt)}</td>
                  <td className="px-4 py-2 text-right">
                    {canApprove && estimate.status === 'DRAFT' ? (
                      <Button size="sm" onClick={() => setApproving(estimate)} disabled={estimate._count.items === 0}>
                        <CheckCircle2 className="size-3.5" aria-hidden />
                        Approve
                      </Button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <ConfirmDialog
        open={approving !== null}
        onOpenChange={(next) => (next ? undefined : setApproving(null))}
        title={`Approve estimate v${approving?.version ?? ''}?`}
        description={`This freezes the estimate and creates budget version from its ${approving?._count.items ?? 0} items totalling ${formatPHP(approving?.directCost)}. Budgeted amounts become the baseline for committed and actual cost.`}
        confirmLabel="Approve and create budget"
        loading={approve.isPending}
        onConfirm={() =>
          approving &&
          approve.mutate(approving.id, {
            onSuccess: (result) => {
              toast.success('Estimate approved', `Budget version ${result.budget.version} created`);
              setApproving(null);
            },
            onError: (error) => toast.error('Could not approve the estimate', errorMessage(error)),
          })
        }
      />
    </Panel>
  );
}

export function ProjectBoq({ project }: { project: ProjectDetail }) {
  const canSeeEstimates = useCan('projects.estimate', 'VIEW', { projectId: project.id });
  const canAdd = useCan('projects.boq', 'CREATE', { projectId: project.id });
  const canEdit = useCan('projects.boq', 'EDIT', { projectId: project.id });
  const canDelete = useCan('projects.boq', 'DELETE', { projectId: project.id });
  const estimates = useEstimates(project.id, canSeeEstimates);
  const list = estimates.data?.items ?? [];
  const [picked, setPicked] = React.useState<string | null>(null);
  const selected =
    list.find((estimate) => estimate.id === picked) ??
    list.find((estimate) => estimate.status === 'APPROVED') ??
    list[0] ??
    null;
  const paging = useCursorPagination();
  const { reset } = paging;
  React.useEffect(() => reset(), [selected?.id, reset]);
  const boq = useBoq(
    project.id,
    { limit: 50, ...(selected ? { estimateId: selected.id } : {}), ...(paging.cursor ? { cursor: paging.cursor } : {}) },
    !canSeeEstimates || Boolean(selected),
  );
  const remove = useDeleteBoqItem(project.id);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<BoqRow | null>(null);
  const [deleting, setDeleting] = React.useState<BoqRow | null>(null);
  const draft = selected?.status === 'DRAFT';
  const page = boq.data;

  const columns = React.useMemo<DataColumn<BoqRow>[]>(
    () => [
      {
        id: 'itemNo',
        header: 'Item',
        accessorFn: (row) => row.itemNo,
        meta: { sticky: true },
        cell: ({ row }) => <span className="font-mono text-xs font-medium">{row.original.itemNo}</span>,
      },
      {
        id: 'description',
        header: 'Description',
        cell: ({ row }) => (
          <div className="min-w-0">
            <p>{row.original.description}</p>
            {row.original.section ? <p className="text-xs text-muted-foreground">{row.original.section}</p> : null}
          </div>
        ),
      },
      { id: 'category', header: 'Category', cell: ({ row }) => <Badge>{titleCase(row.original.costCategory)}</Badge>, meta: { hideBelow: 'lg' } },
      { id: 'wbs', header: 'WBS', cell: ({ row }) => row.original.wbsNode?.code ?? '—', meta: { hideBelow: 'md' } },
      { id: 'costCode', header: 'Cost code', cell: ({ row }) => row.original.costCode?.code ?? '—', meta: { hideBelow: 'lg' } },
      { id: 'qty', header: 'Quantity', cell: ({ row }) => formatQty(row.original.quantity, row.original.unit), meta: { numeric: true } },
      { id: 'rate', header: 'Unit rate', cell: ({ row }) => formatPHP(row.original.unitRate), meta: { numeric: true, hideBelow: 'sm' } },
      {
        id: 'amount',
        header: 'Amount',
        accessorFn: (row) => Number(row.amount),
        enableSorting: true,
        cell: ({ row }) => <span className="font-medium">{formatPHP(row.original.amount)}</span>,
        meta: { numeric: true },
      },
      {
        id: 'done',
        header: 'Completed',
        cell: ({ row }) => formatQty(row.original.completedQty),
        meta: { numeric: true, hideBelow: 'lg' },
      },
      {
        id: 'actions',
        header: () => <span className="sr-only">Actions</span>,
        enableHiding: false,
        meta: { numeric: true },
        cell: ({ row }) =>
          draft ? (
            <div className="flex justify-end gap-1">
              {canEdit ? (
                <IconButton
                  label={`Edit item ${row.original.itemNo}`}
                  size="sm"
                  onClick={() => {
                    setEditing(row.original);
                    setDialogOpen(true);
                  }}
                >
                  <Pencil className="size-3.5" aria-hidden />
                </IconButton>
              ) : null}
              {canDelete ? (
                <IconButton label={`Delete item ${row.original.itemNo}`} size="sm" onClick={() => setDeleting(row.original)}>
                  <Trash2 className="size-3.5" aria-hidden />
                </IconButton>
              ) : null}
            </div>
          ) : null,
      },
    ],
    [draft, canEdit, canDelete],
  );

  if (!canSeeEstimates) {
    return (
      <Panel title="Bill of quantities">
        <p className="text-sm text-muted-foreground">Your role can view BOQ items but not estimate versions.</p>
      </Panel>
    );
  }
  return (
    <div className="space-y-4">
      <Estimates project={project} estimates={list} selectedId={selected?.id ?? null} onSelect={setPicked} />
      {selected ? (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-base font-semibold">Bill of quantities</h2>
            <div className="w-56">
              <Select aria-label="Estimate version" value={selected.id} onChange={(event) => setPicked(event.target.value)}>
                {list.map((estimate) => (
                  <option key={estimate.id} value={estimate.id}>
                    v{estimate.version} · {titleCase(estimate.status)}
                  </option>
                ))}
              </Select>
            </div>
            {draft && canAdd ? (
              <Button
                className="ml-auto"
                variant="primary"
                onClick={() => {
                  setEditing(null);
                  setDialogOpen(true);
                }}
              >
                <Plus className="size-3.5" aria-hidden />
                Add item
              </Button>
            ) : null}
          </div>
          <DataTable
            caption={`BOQ items, estimate version ${selected.version}`}
            columns={columns}
            data={page?.items ?? []}
            getRowId={(row) => row.id}
            loading={boq.isPending}
            error={boq.error}
            onRetry={() => void boq.refetch()}
            maxHeightClassName="max-h-[60vh]"
            getSearchText={(row) => `${row.itemNo} ${row.description} ${row.section ?? ''}`}
            searchPlaceholder="Filter items on this page"
            pagination={{
              count: page?.items.length ?? 0,
              hasPrevious: paging.hasPrevious,
              hasNext: Boolean(page?.nextCursor),
              onPrevious: paging.goPrevious,
              onNext: () => paging.goNext(page?.nextCursor ?? null),
              loading: boq.isFetching,
            }}
            emptyState={
              <EmptyState
                compact
                icon={ListChecks}
                title="No BOQ items in this estimate"
                description={draft ? 'Add the work items with quantities and unit rates, then approve the estimate.' : 'This estimate has no items.'}
                action={
                  draft && canAdd ? (
                    <Button variant="primary" onClick={() => setDialogOpen(true)}>
                      <Plus className="size-3.5" aria-hidden />
                      Add item
                    </Button>
                  ) : undefined
                }
              />
            }
          />
          <ItemDialog open={dialogOpen} onOpenChange={setDialogOpen} project={project} estimate={selected} item={editing} />
          <ConfirmDialog
            open={deleting !== null}
            onOpenChange={(next) => (next ? undefined : setDeleting(null))}
            title={`Delete item ${deleting?.itemNo ?? ''}?`}
            description="The item is removed from this draft estimate and its total is recalculated."
            confirmLabel="Delete item"
            tone="danger"
            loading={remove.isPending}
            onConfirm={() =>
              deleting &&
              remove.mutate(deleting.id, {
                onSuccess: () => {
                  toast.success('BOQ item deleted');
                  setDeleting(null);
                },
                onError: (error) => toast.error('Could not delete the item', errorMessage(error)),
              })
            }
          />
        </div>
      ) : null}
    </div>
  );
}
