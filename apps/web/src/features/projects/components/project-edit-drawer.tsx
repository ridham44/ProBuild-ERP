'use client';

import { updateProjectSchema } from '@probuild/shared';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { SelectField, TextAreaField, TextField } from '@/components/common/form-controls';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Drawer, DrawerContent } from '@/components/ui/drawer';
import { toast } from '@/components/ui/toast';
import { useCan } from '@/features/auth/components/current-user';
import { useUsers } from '@/features/users/api/hooks';
import type { ProjectDetail } from '@/lib/api/types';
import { applyServerErrors, formResolver, withClearedFields } from '@/lib/forms';
import { useUpdateProject } from '../api/hooks';

type FormValues = z.input<typeof updateProjectSchema>;
const FIELDS = [
  'name',
  'managerId',
  'location',
  'fundingSource',
  'contractAmount',
  'retentionPct',
  'advancePct',
  'ldRatePct',
  'warrantyMonths',
  'startDate',
  'originalEndDate',
  'revisedEndDate',
  'paymentTerms',
] as const;
const CLEARABLE = ['managerId', 'location', 'fundingSource', 'startDate', 'originalEndDate', 'revisedEndDate', 'paymentTerms'];

const day = (value: string | null): string => (value ? value.slice(0, 10) : '');

function defaultsFor(project: ProjectDetail): FormValues {
  return {
    name: project.name,
    managerId: project.managerId ?? '',
    location: project.location ?? '',
    fundingSource: project.fundingSource ?? '',
    contractAmount: project.contractAmount,
    retentionPct: project.retentionPct,
    advancePct: project.advancePct,
    ldRatePct: project.ldRatePct,
    warrantyMonths: project.warrantyMonths,
    startDate: day(project.startDate),
    originalEndDate: day(project.originalEndDate),
    revisedEndDate: day(project.revisedEndDate),
    paymentTerms: project.paymentTerms ?? '',
  };
}

function BodyGate({ project, onClose }: { project: ProjectDetail; onClose: () => void }) {
  const canSeeUsers = useCan('security.user', 'VIEW');
  const users = useUsers('', canSeeUsers);
  if (canSeeUsers && users.isPending) return <p className="p-4 text-sm text-muted-foreground">Loading…</p>;
  return <Body project={project} onClose={onClose} />;
}

function Body({ project, onClose }: { project: ProjectDetail; onClose: () => void }) {
  const update = useUpdateProject(project.id);
  const canSeeUsers = useCan('security.user', 'VIEW');
  const users = useUsers('', canSeeUsers);
  const [formError, setFormError] = React.useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: formResolver<FormValues>(updateProjectSchema),
    defaultValues: defaultsFor(project),
  });

  function submit(values: FormValues): void {
    setFormError(null);
    update.mutate(withClearedFields(defaultsFor(project), values, CLEARABLE), {
      onSuccess: () => {
        toast.success('Project updated');
        onClose();
      },
      onError: (error) => setFormError(applyServerErrors(error, setError, FIELDS)),
    });
  }

  return (
    <form onSubmit={handleSubmit(submit)} noValidate className="flex min-h-0 flex-1 flex-col">
      <div className="scroll-thin flex-1 space-y-4 overflow-y-auto p-4">
        {formError ? <Alert tone="danger">{formError}</Alert> : null}
        <TextField label="Project name" required error={errors.name?.message} {...register('name')} />
        {canSeeUsers ? (
          <SelectField label="Project manager" error={errors.managerId?.message} {...register('managerId')}>
            <option value="">Unassigned</option>
            {(users.data ?? [])
              .filter((user) => user.active || user.id === project.managerId)
              .map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
          </SelectField>
        ) : null}
        <TextField label="Site location" error={errors.location?.message} {...register('location')} />
        <TextField label="Funding source" error={errors.fundingSource?.message} {...register('fundingSource')} />
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField label="Contract amount (PHP)" inputMode="decimal" error={errors.contractAmount?.message} {...register('contractAmount')} />
          <TextField label="Retention (%)" inputMode="decimal" error={errors.retentionPct?.message} {...register('retentionPct')} />
          <TextField label="Advance payment (%)" inputMode="decimal" error={errors.advancePct?.message} {...register('advancePct')} />
          <TextField label="Liquidated damages (%)" inputMode="decimal" error={errors.ldRatePct?.message} {...register('ldRatePct')} />
          <TextField label="Start date" type="date" error={errors.startDate?.message} {...register('startDate')} />
          <TextField label="Planned completion" type="date" error={errors.originalEndDate?.message} {...register('originalEndDate')} />
          <TextField label="Revised completion" type="date" error={errors.revisedEndDate?.message} {...register('revisedEndDate')} />
          <TextField
            label="Warranty (months)"
            type="number"
            min={0}
            max={120}
            error={errors.warrantyMonths?.message}
            {...register('warrantyMonths', { valueAsNumber: true })}
          />
        </div>
        <TextAreaField label="Payment terms" error={errors.paymentTerms?.message} {...register('paymentTerms')} />
      </div>
      <div className="flex justify-end gap-2 border-t border-border bg-surface-muted/50 px-4 py-2.5">
        <Button onClick={onClose} disabled={update.isPending}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" loading={update.isPending}>
          Save changes
        </Button>
      </div>
    </form>
  );
}

export function ProjectEditDrawer({
  open,
  onOpenChange,
  project,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: ProjectDetail;
}) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent
        className="w-[min(34rem,100vw)]"
        title={`Edit ${project.code}`}
        description="Code and client are fixed once a project exists."
      >
        {open ? <BodyGate key={project.updatedAt} project={project} onClose={() => onOpenChange(false)} /> : null}
      </DrawerContent>
    </Drawer>
  );
}
