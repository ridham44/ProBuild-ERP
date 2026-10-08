'use client';

import { createContractSchema } from '@probuild/shared';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { SelectField, TextAreaField, TextField } from '@/components/common/form-controls';
import { DetailList, Panel } from '@/components/common/panel';
import { StatusBadge } from '@/components/common/status-badge';
import { Alert } from '@/components/ui/alert';
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
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/toast';
import { useCan } from '@/features/auth/components/current-user';
import { errorMessage } from '@/lib/api/errors';
import type { ProjectDetail } from '@/lib/api/types';
import { applyServerErrors, formResolver } from '@/lib/forms';
import { formatDate, formatPHP, titleCase } from '@/lib/format';
import { useActivateContract, useCreateContract, useProjectContracts, useProjectDashboard } from '../api/hooks';

type ContractValues = z.input<typeof createContractSchema>;

function ContractDialog({
  open,
  onOpenChange,
  projectId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
}) {
  const create = useCreateContract(projectId);
  const [formError, setFormError] = React.useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors },
  } = useForm<ContractValues>({
    resolver: formResolver<ContractValues>(createContractSchema),
    defaultValues: { title: '', contractType: 'LUMP_SUM', originalAmount: '' },
  });
  React.useEffect(() => {
    if (open) {
      reset({ title: '', contractType: 'LUMP_SUM', originalAmount: '' });
      setFormError(null);
    }
  }, [open, reset]);

  function submit(values: ContractValues): void {
    setFormError(null);
    create.mutate(values, {
      onSuccess: (contract) => {
        toast.success('Contract drafted', contract.number);
        onOpenChange(false);
      },
      onError: (error) =>
        setFormError(
          applyServerErrors(error, setError, ['title', 'contractType', 'originalAmount', 'signedDate', 'noticeToProceed', 'clauses'] as const),
        ),
    });
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (create.isPending ? undefined : onOpenChange(next))}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>New contract</DialogTitle>
          <DialogDescription>
            A contract is created as a draft. Once activated it sets the project&apos;s contract value.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(submit)} noValidate className="flex min-h-0 flex-1 flex-col">
          <DialogBody className="space-y-3">
            {formError ? <Alert tone="danger">{formError}</Alert> : null}
            <TextField label="Title" required autoFocus error={errors.title?.message} {...register('title')} />
            <div className="grid gap-3 sm:grid-cols-2">
              <SelectField label="Contract type" error={errors.contractType?.message} {...register('contractType')}>
                <option value="LUMP_SUM">Lump sum</option>
                <option value="UNIT_PRICE">Unit price</option>
                <option value="COST_PLUS">Cost plus</option>
                <option value="DESIGN_BUILD">Design and build</option>
              </SelectField>
              <TextField label="Contract amount (PHP)" required inputMode="decimal" error={errors.originalAmount?.message} {...register('originalAmount')} />
              <TextField label="Date signed" type="date" error={errors.signedDate?.message} {...register('signedDate')} />
              <TextField label="Notice to proceed" type="date" error={errors.noticeToProceed?.message} {...register('noticeToProceed')} />
            </div>
            <TextAreaField label="Key clauses" error={errors.clauses?.message} {...register('clauses')} />
          </DialogBody>
          <DialogFooter>
            <Button onClick={() => onOpenChange(false)} disabled={create.isPending}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={create.isPending}>
              Create contract
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Contracts({ projectId }: { projectId: string }) {
  const canView = useCan('projects.contract', 'VIEW', { projectId });
  const canCreate = useCan('projects.contract', 'CREATE', { projectId });
  const canActivate = useCan('projects.contract', 'APPROVE', { projectId });
  const contracts = useProjectContracts(projectId, canView);
  const activate = useActivateContract(projectId);
  const [open, setOpen] = React.useState(false);
  if (!canView) return null;
  return (
    <Panel
      title="Contracts"
      bodyClassName="p-0"
      actions={
        canCreate ? (
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus className="size-3.5" aria-hidden />
            New contract
          </Button>
        ) : null
      }
    >
      {contracts.isPending ? (
        <div className="p-4">
          <Skeleton className="h-12" />
        </div>
      ) : (contracts.data ?? []).length === 0 ? (
        <p className="px-4 py-6 text-sm text-muted-foreground">
          No contract on file. The project&apos;s contract value is taken from the project record until a contract is activated.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {(contracts.data ?? []).map((contract) => (
            <li key={contract.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 text-sm">
              <span className="font-mono text-xs font-medium">{contract.number}</span>
              <span className="font-medium">{contract.title}</span>
              <span className="text-muted-foreground">{titleCase(contract.contractType)}</span>
              <StatusBadge status={contract.status} />
              <span className="num ml-auto">{formatPHP(contract.currentAmount)}</span>
              {canActivate && contract.status === 'DRAFT' ? (
                <Button
                  size="sm"
                  loading={activate.isPending && activate.variables === contract.id}
                  onClick={() =>
                    activate.mutate(contract.id, {
                      onSuccess: () => toast.success('Contract activated', contract.number),
                      onError: (error) => toast.error('Could not activate the contract', errorMessage(error)),
                    })
                  }
                >
                  Activate
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      <ContractDialog open={open} onOpenChange={setOpen} projectId={projectId} />
    </Panel>
  );
}

export function ProjectOverview({ project }: { project: ProjectDetail }) {
  const dashboard = useProjectDashboard(project.id);
  const counts = dashboard.data?.counts;
  const stats: Array<{ label: string; value: number | undefined; href?: string }> = [
    { label: 'Open requisitions', value: counts?.openRequisitions, href: '?tab=procurement' },
    { label: 'Open purchase orders', value: counts?.openPurchaseOrders, href: '?tab=procurement' },
    { label: 'WBS nodes', value: counts?.wbsNodes, href: '?tab=wbs' },
    { label: 'BOQ items', value: counts?.boqItems, href: '?tab=boq' },
    { label: 'Team members', value: counts?.teamMembers, href: '?tab=team' },
  ];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {stats.map((stat) => (
          <Link
            key={stat.label}
            href={stat.href ?? '#'}
            className="rounded-lg border border-border bg-surface px-4 py-3 transition-colors hover:border-border-strong hover:bg-surface-muted/50"
          >
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{stat.label}</p>
            {dashboard.isPending ? (
              <Skeleton className="mt-2 h-6 w-10" />
            ) : (
              <p className="num mt-1 text-2xl font-semibold leading-none">{stat.value ?? '—'}</p>
            )}
          </Link>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Project">
          <DetailList
            columns={2}
            items={[
              { label: 'Type', value: titleCase(project.type) },
              { label: 'Sector', value: titleCase(project.sector) },
              { label: 'Location', value: project.location, wide: true },
              { label: 'Funding source', value: project.fundingSource },
              { label: 'Branch', value: project.branch?.name },
              { label: 'Start date', value: formatDate(project.startDate) },
              { label: 'Planned completion', value: formatDate(project.originalEndDate) },
              { label: 'Revised completion', value: project.revisedEndDate ? formatDate(project.revisedEndDate) : null },
            ]}
          />
        </Panel>
        <Panel title="Commercial terms">
          <DetailList
            columns={2}
            items={[
              { label: 'Contract amount (project record)', value: formatPHP(project.contractAmount), numeric: true },
              { label: 'Active contract', value: project.activeContract ? `${project.activeContract.number} · ${formatPHP(project.activeContract.currentAmount)}` : 'None' },
              { label: 'Retention', value: `${project.retentionPct}%`, numeric: true },
              { label: 'Advance payment', value: `${project.advancePct}%`, numeric: true },
              { label: 'Liquidated damages', value: `${project.ldRatePct}% per day`, numeric: true },
              { label: 'Warranty', value: `${project.warrantyMonths} months`, numeric: true },
              { label: 'Payment terms', value: project.paymentTerms, wide: true },
            ]}
          />
        </Panel>
      </div>
      <Contracts projectId={project.id} />
    </div>
  );
}
