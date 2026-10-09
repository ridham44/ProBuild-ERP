'use client';

import { ArrowRight, Plus, Workflow } from 'lucide-react';
import * as React from 'react';
import { EmptyState } from '@/components/common/empty-state';
import { QueryErrorState } from '@/components/common/error-state';
import { PageHeader } from '@/components/common/page-header';
import { StatusBadge } from '@/components/common/status-badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from '@/components/ui/table';
import { useCan } from '@/features/auth/components/current-user';
import { PermissionGate } from '@/features/auth/components/permission-gate';
import type { WorkflowDto } from '@/lib/api/types';
import { formatPHP } from '@/lib/format';
import { useWorkflows } from '../api/hooks';
import { documentTypeLabel } from '../model';
import { WorkflowDialog } from './workflow-dialog';

function WorkflowCard({
  workflow,
  canEdit,
  onEdit,
}: {
  workflow: WorkflowDto;
  canEdit: boolean;
  onEdit: () => void;
}) {
  return (
    <section
      className="overflow-hidden rounded-xl border border-border bg-surface shadow-card"
      aria-label={`${documentTypeLabel(workflow.documentType)} workflow`}
    >
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-base font-semibold tracking-tight">{documentTypeLabel(workflow.documentType)}</h2>
          <StatusBadge status={workflow.active ? 'ACTIVE' : 'INACTIVE'} />
          <span className="text-sm text-muted-foreground">{workflow.name}</span>
        </div>
        {canEdit ? (
          <Button size="sm" onClick={onEdit}>
            Edit
          </Button>
        ) : null}
      </header>
      <div className="overflow-x-auto">
        <Table>
          <TableHead>
            <tr>
              <TableHeaderCell numeric>From</TableHeaderCell>
              <TableHeaderCell numeric>Up to</TableHeaderCell>
              <TableHeaderCell>Approval steps</TableHeaderCell>
            </tr>
          </TableHead>
          <TableBody>
            {workflow.rules.map((rule) => (
              <TableRow key={rule.id}>
                <TableCell numeric>{formatPHP(rule.minAmount)}</TableCell>
                <TableCell numeric>
                  {rule.maxAmount === null ? (
                    <span className="text-muted-foreground">No limit</span>
                  ) : (
                    formatPHP(rule.maxAmount)
                  )}
                </TableCell>
                <TableCell>
                  <ol className="flex flex-wrap items-center gap-1.5">
                    {rule.steps.map((step, index) => (
                      <li key={step.id} className="flex items-center gap-1.5">
                        {index > 0 ? (
                          <ArrowRight className="size-3 text-subtle-foreground" aria-hidden />
                        ) : null}
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-primary-border bg-primary-subtle py-0.5 pl-0.5 pr-2 text-xs font-medium text-foreground">
                          <span className="num flex size-4 items-center justify-center rounded-full bg-primary text-2xs text-primary-foreground">{index + 1}</span>
                          {step.roleName}
                        </span>
                      </li>
                    ))}
                  </ol>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}

export function WorkflowsView() {
  const canEdit = useCan('security.workflow', 'EDIT');
  const workflows = useWorkflows();
  const [editing, setEditing] = React.useState<WorkflowDto | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const existingTypes = workflows.data?.map((workflow) => workflow.documentType) ?? [];

  function open(workflow: WorkflowDto | null): void {
    setEditing(workflow);
    setDialogOpen(true);
  }

  const newButton = canEdit ? (
    <Button variant="primary" onClick={() => open(null)}>
      <Plus className="size-3.5" aria-hidden />
      New workflow
    </Button>
  ) : null;

  return (
    <PermissionGate module="security.workflow">
      <PageHeader
        title="Approval workflows"
        description="For each document type, which roles approve and in what order, based on the document amount."
        breadcrumbs={[{ label: 'Administration' }, { label: 'Approval workflows' }]}
        actions={newButton}
      />
      {workflows.isPending ? (
        <div className="space-y-4" role="status" aria-label="Loading workflows">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      ) : workflows.isError ? (
        <QueryErrorState
          error={workflows.error}
          onRetry={() => void workflows.refetch()}
          retrying={workflows.isFetching}
        />
      ) : workflows.data.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface">
          <EmptyState
            icon={Workflow}
            title="No approval workflows configured"
            description="Without a workflow, submitted documents are approved immediately. Add one to require sign-off by amount."
            action={newButton ?? undefined}
          />
        </div>
      ) : (
        <div className="space-y-4">
          {workflows.data.map((workflow) => (
            <WorkflowCard
              key={workflow.id}
              workflow={workflow}
              canEdit={canEdit}
              onEdit={() => open(workflow)}
            />
          ))}
        </div>
      )}
      <WorkflowDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        workflow={editing}
        existingTypes={existingTypes}
      />
    </PermissionGate>
  );
}
