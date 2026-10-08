'use client';

import { createWbsNodeSchema } from '@probuild/shared';
import { ArrowRightLeft, Layers, Pencil, Plus, Trash2 } from 'lucide-react';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { EmptyState } from '@/components/common/empty-state';
import { QueryErrorState } from '@/components/common/error-state';
import { SelectField, TextField } from '@/components/common/form-controls';
import { Panel } from '@/components/common/panel';
import { Alert } from '@/components/ui/alert';
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
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/toast';
import { useCan } from '@/features/auth/components/current-user';
import { errorMessage } from '@/lib/api/errors';
import type { ProjectDetail, WbsRow } from '@/lib/api/types';
import { applyServerErrors, formResolver } from '@/lib/forms';
import { formatQty } from '@/lib/format';
import {
  useCreateWbsNode,
  useDeleteWbsNode,
  useMoveWbsNode,
  useUpdateWbsNode,
  useWbs,
} from '../api/hooks';
import { ProgressBar } from './progress-bar';

type NodeValues = { code: string; name: string; weightPct?: string; parentId?: string };

/** Ids of a node and everything beneath it; a node can never be moved under itself. */
export function descendantIds(rows: WbsRow[], id: string): Set<string> {
  const ids = new Set<string>([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const row of rows) {
      if (row.parentId && ids.has(row.parentId) && !ids.has(row.id)) {
        ids.add(row.id);
        grew = true;
      }
    }
  }
  return ids;
}

function NodeDialog({
  open,
  onOpenChange,
  projectId,
  node,
  parent,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  node: WbsRow | null;
  parent: WbsRow | null;
}) {
  const create = useCreateWbsNode(projectId);
  const update = useUpdateWbsNode(projectId);
  const [formError, setFormError] = React.useState<string | null>(null);
  const pending = create.isPending || update.isPending;
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors },
  } = useForm<NodeValues>({
    resolver: formResolver<NodeValues>(createWbsNodeSchema),
    defaultValues: { code: '', name: '', weightPct: '' },
  });
  React.useEffect(() => {
    if (open) {
      reset({ code: node?.code ?? '', name: node?.name ?? '', weightPct: node ? node.weightPct : '' });
      setFormError(null);
    }
  }, [open, node, reset]);

  function submit(values: NodeValues): void {
    setFormError(null);
    const callbacks = {
      onSuccess: () => {
        toast.success(node ? 'WBS node updated' : 'WBS node added');
        onOpenChange(false);
      },
      onError: (error: unknown) => setFormError(applyServerErrors(error, setError, ['code', 'name', 'weightPct'] as const)),
    };
    if (node) update.mutate({ id: node.id, body: values }, callbacks);
    else create.mutate({ ...values, ...(parent ? { parentId: parent.id } : {}) }, callbacks);
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (pending ? undefined : onOpenChange(next))}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>{node ? `Edit ${node.code}` : parent ? `Add under ${parent.code}` : 'Add top-level WBS node'}</DialogTitle>
          <DialogDescription>
            Weight is this node&apos;s share of its parent, used to roll progress up.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(submit)} noValidate className="flex min-h-0 flex-1 flex-col">
          <DialogBody className="space-y-3">
            {formError ? <Alert tone="danger">{formError}</Alert> : null}
            <TextField label="Code" required autoFocus inputClassName="font-mono" hint="e.g. 1.2.3" error={errors.code?.message} {...register('code')} />
            <TextField label="Name" required error={errors.name?.message} {...register('name')} />
            <TextField label="Weight (%)" inputMode="decimal" error={errors.weightPct?.message} {...register('weightPct')} />
          </DialogBody>
          <DialogFooter>
            <Button onClick={() => onOpenChange(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={pending}>
              {node ? 'Save' : 'Add node'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function MoveDialog({
  open,
  onOpenChange,
  projectId,
  node,
  rows,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  node: WbsRow | null;
  rows: WbsRow[];
}) {
  const move = useMoveWbsNode(projectId);
  const [parentId, setParentId] = React.useState('');
  const [sortOrder, setSortOrder] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (open && node) {
      setParentId(node.parentId ?? '');
      setSortOrder(String(node.sortOrder));
      setError(null);
    }
  }, [open, node]);
  const excluded = node ? descendantIds(rows, node.id) : new Set<string>();

  function submit(event: React.FormEvent): void {
    event.preventDefault();
    if (!node) return;
    setError(null);
    move.mutate(
      {
        id: node.id,
        body: { parentId: parentId || null, ...(sortOrder.trim() !== '' ? { sortOrder: Number(sortOrder) } : {}) },
      },
      {
        onSuccess: () => {
          toast.success('WBS node moved');
          onOpenChange(false);
        },
        onError: (cause) => setError(errorMessage(cause)),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (move.isPending ? undefined : onOpenChange(next))}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Move {node?.code}</DialogTitle>
          <DialogDescription>Choose the new parent and the position among its siblings. Children move with it.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          <DialogBody className="space-y-3">
            {error ? <Alert tone="danger">{error}</Alert> : null}
            <SelectField label="New parent" value={parentId} onChange={(event) => setParentId(event.target.value)}>
              <option value="">Top level</option>
              {rows
                .filter((row) => !excluded.has(row.id))
                .map((row) => (
                  <option key={row.id} value={row.id}>
                    {`${'  '.repeat(row.depth)}${row.code} ${row.name}`}
                  </option>
                ))}
            </SelectField>
            <TextField
              label="Position"
              type="number"
              min={0}
              hint="Lower numbers come first."
              value={sortOrder}
              onChange={(event) => setSortOrder(event.target.value)}
            />
          </DialogBody>
          <DialogFooter>
            <Button onClick={() => onOpenChange(false)} disabled={move.isPending}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={move.isPending}>
              Move
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ProjectWbs({ project }: { project: ProjectDetail }) {
  const canCreate = useCan('projects.wbs', 'CREATE', { projectId: project.id });
  const canEdit = useCan('projects.wbs', 'EDIT', { projectId: project.id });
  const canDelete = useCan('projects.wbs', 'DELETE', { projectId: project.id });
  const wbs = useWbs(project.id);
  const remove = useDeleteWbsNode(project.id);
  const [dialog, setDialog] = React.useState<{ node: WbsRow | null; parent: WbsRow | null } | null>(null);
  const [moving, setMoving] = React.useState<WbsRow | null>(null);
  const [deleting, setDeleting] = React.useState<WbsRow | null>(null);
  const rows = wbs.data ?? [];

  return (
    <Panel
      title="Work breakdown structure"
      description="Costs, BOQ items and requisition lines are coded to these nodes."
      bodyClassName="p-0"
      actions={
        canCreate ? (
          <Button size="sm" onClick={() => setDialog({ node: null, parent: null })}>
            <Plus className="size-3.5" aria-hidden />
            Add top-level node
          </Button>
        ) : null
      }
    >
      {wbs.isPending ? (
        <div className="space-y-2 p-4">
          <Skeleton className="h-8" />
          <Skeleton className="h-8" />
          <Skeleton className="h-8" />
        </div>
      ) : wbs.isError ? (
        <QueryErrorState error={wbs.error} onRetry={() => void wbs.refetch()} compact />
      ) : rows.length === 0 ? (
        <EmptyState
          compact
          icon={Layers}
          title="No WBS yet"
          description="Break the project into phases and work packages, for example Structural Works, then Footings, Columns and Slabs."
          action={
            canCreate ? (
              <Button variant="primary" onClick={() => setDialog({ node: null, parent: null })}>
                <Plus className="size-3.5" aria-hidden />
                Add top-level node
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm" aria-label="WBS tree">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-2 font-medium">Node</th>
                <th className="px-3 py-2 text-right font-medium">Weight</th>
                <th className="hidden px-3 py-2 font-medium sm:table-cell">Progress</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-border last:border-0 hover:bg-surface-muted/60">
                  <td className="py-1.5 pr-3" style={{ paddingLeft: `${1 + row.depth * 1.5}rem` }}>
                    <span className="font-mono text-xs font-medium">{row.code}</span>{' '}
                    <span className={row.hasChildren ? 'font-medium' : ''}>{row.name}</span>
                  </td>
                  <td className="num px-3 py-1.5 text-right text-muted-foreground">{formatQty(row.weightPct, undefined, 2)}%</td>
                  <td className="hidden w-48 px-3 py-1.5 sm:table-cell">
                    <ProgressBar value={row.progressPct} label={`${row.code} progress`} />
                  </td>
                  <td className="px-4 py-1.5">
                    <div className="flex justify-end gap-0.5">
                      {canCreate ? (
                        <IconButton label={`Add under ${row.code}`} size="sm" onClick={() => setDialog({ node: null, parent: row })}>
                          <Plus className="size-3.5" aria-hidden />
                        </IconButton>
                      ) : null}
                      {canEdit ? (
                        <>
                          <IconButton label={`Edit ${row.code}`} size="sm" onClick={() => setDialog({ node: row, parent: null })}>
                            <Pencil className="size-3.5" aria-hidden />
                          </IconButton>
                          <IconButton label={`Move ${row.code}`} size="sm" onClick={() => setMoving(row)}>
                            <ArrowRightLeft className="size-3.5" aria-hidden />
                          </IconButton>
                        </>
                      ) : null}
                      {canDelete ? (
                        <IconButton label={`Delete ${row.code}`} size="sm" onClick={() => setDeleting(row)}>
                          <Trash2 className="size-3.5" aria-hidden />
                        </IconButton>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <NodeDialog
        open={dialog !== null}
        onOpenChange={(open) => (open ? undefined : setDialog(null))}
        projectId={project.id}
        node={dialog?.node ?? null}
        parent={dialog?.parent ?? null}
      />
      <MoveDialog open={moving !== null} onOpenChange={(open) => (open ? undefined : setMoving(null))} projectId={project.id} node={moving} rows={rows} />
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => (open ? undefined : setDeleting(null))}
        title={`Delete ${deleting?.code ?? 'node'}?`}
        description="A node that has children, BOQ items or postings cannot be deleted; the server will say so if that applies."
        confirmLabel="Delete"
        tone="danger"
        loading={remove.isPending}
        onConfirm={() =>
          deleting &&
          remove.mutate(deleting.id, {
            onSuccess: () => {
              toast.success('WBS node deleted');
              setDeleting(null);
            },
            onError: (error) => {
              toast.error('Could not delete the node', errorMessage(error));
              setDeleting(null);
            },
          })
        }
      />
    </Panel>
  );
}
