'use client';

import { createProjectSchema } from '@probuild/shared';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { Controller, useForm } from 'react-hook-form';
import type { z } from 'zod';
import { EntityCombobox } from '@/components/common/entity-combobox';
import { SelectField, TextAreaField, TextField } from '@/components/common/form-controls';
import { FormField } from '@/components/common/form-field';
import { PageHeader } from '@/components/common/page-header';
import { DetailList, Panel } from '@/components/common/panel';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';
import { useCan } from '@/features/auth/components/current-user';
import { PermissionGate } from '@/features/auth/components/permission-gate';
import { useBranches } from '@/features/branches/api/hooks';
import { searchCustomerOptions } from '@/features/customers/api/hooks';
import { useUsers } from '@/features/users/api/hooks';
import { applyServerErrors, formResolver } from '@/lib/forms';
import { formatPHP, titleCase } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useCreateProject } from '../api/hooks';
import { PROJECT_TYPE_OPTIONS } from '../model';

type FormValues = z.input<typeof createProjectSchema>;
type FieldName = keyof FormValues;

const STEPS: Array<{ id: string; title: string; fields: FieldName[] }> = [
  { id: 'project', title: 'Project', fields: ['code', 'name', 'customerId', 'type', 'sector', 'location', 'fundingSource'] },
  {
    id: 'terms',
    title: 'Contract and terms',
    fields: ['contractAmount', 'retentionPct', 'advancePct', 'warrantyMonths', 'ldRatePct', 'paymentTerms'],
  },
  { id: 'schedule', title: 'Schedule and team', fields: ['startDate', 'originalEndDate', 'branchId', 'managerId'] },
];
const ALL_FIELDS = STEPS.flatMap((step) => step.fields);

export function ProjectWizard() {
  const router = useRouter();
  const create = useCreateProject();
  const canSeeBranches = useCan('organization.branch', 'VIEW');
  const canSeeUsers = useCan('security.user', 'VIEW');
  const branches = useBranches({ limit: 100 }, canSeeBranches);
  const users = useUsers('', canSeeUsers);
  const [step, setStep] = React.useState(0);
  const [customerLabel, setCustomerLabel] = React.useState('');
  const [formError, setFormError] = React.useState<string | null>(null);
  const {
    register,
    control,
    handleSubmit,
    setError,
    trigger,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: formResolver<FormValues>(createProjectSchema),
    defaultValues: { code: '', name: '', customerId: '', type: 'GENERAL_BUILDING', sector: 'PRIVATE', location: '' },
    shouldUnregister: false,
  });
  const values = watch();
  const lastStep = step === STEPS.length - 1;

  async function next(): Promise<void> {
    const current = STEPS[step];
    if (!current) return;
    const ok = await trigger(current.fields);
    if (ok) setStep((value) => Math.min(value + 1, STEPS.length - 1));
  }

  function submit(payload: FormValues): void {
    if (create.isPending) return;
    setFormError(null);
    create.mutate(payload, {
      onSuccess: (project) => {
        toast.success('Project created', `${project.code} · ${project.name}`);
        router.push(`/projects/${project.id}`);
      },
      onError: (error) => {
        const message = applyServerErrors(error, setError, ALL_FIELDS);
        setFormError(message);
        const failing = STEPS.findIndex((candidate) => candidate.fields.some((field) => errors[field]));
        if (failing >= 0) setStep(failing);
      },
    });
  }

  function hasErrors(index: number): boolean {
    return STEPS[index]?.fields.some((field) => errors[field]) ?? false;
  }

  return (
    <PermissionGate module="projects.project" action="CREATE">
      <PageHeader
        title="New project"
        description="Set up the project record. WBS, bill of quantities and budget are added from the project workspace."
        breadcrumbs={[{ label: 'Projects', href: '/projects' }, { label: 'New project' }]}
      />
      <ol className="mb-5 flex flex-wrap gap-2" aria-label="Steps">
        {STEPS.map((entry, index) => (
          <li key={entry.id}>
            <button
              type="button"
              onClick={() => setStep(index)}
              aria-current={index === step ? 'step' : undefined}
              className={cn(
                'flex h-8 items-center gap-2 rounded border px-3 text-sm',
                index === step ? 'border-primary bg-primary-subtle font-medium text-foreground' : 'border-border bg-surface text-muted-foreground hover:text-foreground',
                hasErrors(index) && 'border-danger text-danger',
              )}
            >
              <span className="num flex size-4 items-center justify-center rounded-full bg-surface-muted text-2xs">
                {index < step && !hasErrors(index) ? <Check className="size-3" aria-hidden /> : index + 1}
              </span>
              {entry.title}
            </button>
          </li>
        ))}
      </ol>
      <form onSubmit={handleSubmit(submit)} noValidate className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-4">
          {formError ? <Alert tone="danger">{formError}</Alert> : null}
          <Panel title={STEPS[step]?.title}>
            <div className={cn('grid gap-4 sm:grid-cols-2', step !== 0 && 'hidden')}>
              <TextField label="Project code" required autoFocus inputClassName="font-mono" error={errors.code?.message} {...register('code')} />
              <TextField label="Project name" required error={errors.name?.message} {...register('name')} />
              <FormField label="Client" required wide error={errors.customerId?.message}>
                {(field) => (
                  <Controller
                    control={control}
                    name="customerId"
                    render={({ field: bound }) => (
                      <EntityCombobox
                        entity="customers"
                        id={field.id}
                        search={searchCustomerOptions}
                        value={bound.value || null}
                        selectedLabel={customerLabel}
                        onChange={(value, option) => {
                          bound.onChange(value ?? '');
                          setCustomerLabel(option?.label ?? '');
                        }}
                        placeholder="Search customers"
                        aria-invalid={field['aria-invalid']}
                        aria-describedby={field['aria-describedby']}
                      />
                    )}
                  />
                )}
              </FormField>
              <SelectField label="Project type" error={errors.type?.message} {...register('type')}>
                {PROJECT_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </SelectField>
              <SelectField label="Sector" error={errors.sector?.message} {...register('sector')}>
                <option value="PRIVATE">Private</option>
                <option value="GOVERNMENT">Government</option>
              </SelectField>
              <TextField label="Site location" wide error={errors.location?.message} {...register('location')} />
              <TextField label="Funding source" hint="For government projects, e.g. GAA or LGU funds." error={errors.fundingSource?.message} {...register('fundingSource')} />
            </div>
            <div className={cn('grid gap-4 sm:grid-cols-2', step !== 1 && 'hidden')}>
              <TextField label="Contract amount (PHP)" inputMode="decimal" error={errors.contractAmount?.message} {...register('contractAmount')} />
              <TextField label="Retention (%)" inputMode="decimal" error={errors.retentionPct?.message} {...register('retentionPct')} />
              <TextField label="Advance payment (%)" inputMode="decimal" error={errors.advancePct?.message} {...register('advancePct')} />
              <TextField label="Liquidated damages (% per day)" inputMode="decimal" error={errors.ldRatePct?.message} {...register('ldRatePct')} />
              <TextField
                label="Warranty (months)"
                type="number"
                min={0}
                max={120}
                error={errors.warrantyMonths?.message}
                {...register('warrantyMonths', { valueAsNumber: true })}
              />
              <TextAreaField label="Payment terms" wide error={errors.paymentTerms?.message} {...register('paymentTerms')} />
            </div>
            <div className={cn('grid gap-4 sm:grid-cols-2', step !== 2 && 'hidden')}>
              <TextField label="Start date" type="date" error={errors.startDate?.message} {...register('startDate')} />
              <TextField label="Planned completion" type="date" error={errors.originalEndDate?.message} {...register('originalEndDate')} />
              {canSeeBranches ? (
                <SelectField label="Branch" error={errors.branchId?.message} {...register('branchId')}>
                  <option value="">No branch</option>
                  {(branches.data?.items ?? [])
                    .filter((branch) => branch.active)
                    .map((branch) => (
                      <option key={branch.id} value={branch.id}>
                        {branch.name}
                      </option>
                    ))}
                </SelectField>
              ) : null}
              {canSeeUsers ? (
                <SelectField label="Project manager" error={errors.managerId?.message} {...register('managerId')}>
                  <option value="">Unassigned</option>
                  {(users.data ?? [])
                    .filter((user) => user.active && user.userType === 'INTERNAL')
                    .map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name}
                      </option>
                    ))}
                </SelectField>
              ) : null}
            </div>
          </Panel>
          <div className="flex items-center justify-between">
            <Button asChild>
              <Link href="/projects">Cancel</Link>
            </Button>
            <div className="flex gap-2">
              {step > 0 ? (
                <Button onClick={() => setStep(step - 1)}>
                  <ArrowLeft className="size-3.5" aria-hidden />
                  Back
                </Button>
              ) : null}
              {lastStep ? (
                <Button type="submit" variant="primary" loading={create.isPending}>
                  Create project
                </Button>
              ) : (
                <Button variant="primary" onClick={() => void next()}>
                  Continue
                  <ArrowRight className="size-3.5" aria-hidden />
                </Button>
              )}
            </div>
          </div>
        </div>
        <Panel title="Summary" className="self-start">
          <DetailList
            columns={2}
            className="sm:grid-cols-1 lg:grid-cols-1"
            items={[
              { label: 'Code', value: values.code ? <span className="font-mono">{values.code}</span> : null },
              { label: 'Name', value: values.name },
              { label: 'Client', value: customerLabel },
              { label: 'Type', value: values.type ? titleCase(values.type) : null },
              { label: 'Contract amount', value: values.contractAmount ? formatPHP(values.contractAmount) : null, numeric: true },
              { label: 'Start', value: values.startDate },
              { label: 'Planned completion', value: values.originalEndDate },
            ]}
          />
          <p className="mt-3 text-xs text-muted-foreground">
            New projects start in the pipeline stage. Activate the project from its workspace when work begins.
          </p>
        </Panel>
      </form>
    </PermissionGate>
  );
}
