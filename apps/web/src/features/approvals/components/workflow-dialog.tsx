'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { APPROVAL_DOCUMENT_TYPES } from '@probuild/shared';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import * as React from 'react';
import {
  Controller,
  useFieldArray,
  useForm,
  type Control,
  type UseFormRegister,
} from 'react-hook-form';
import { CurrencyInput } from '@/components/common/number-inputs';
import { FormField } from '@/components/common/form-field';
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
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/components/ui/toast';
import { useRoles } from '@/features/roles/api/hooks';
import type { WorkflowDto } from '@/lib/api/types';
import { applyServerErrors } from '@/lib/forms';
import { useUpsertWorkflow } from '../api/hooks';
import { documentTypeLabel } from '../model';
import { workflowFormSchema, type WorkflowFormInput, type WorkflowFormOutput } from '../schemas';

function toFormValues(workflow: WorkflowDto | null, documentType: string): WorkflowFormInput {
  if (!workflow) {
    return {
      documentType: documentType as WorkflowFormInput['documentType'],
      name: `${documentTypeLabel(documentType)} approval`,
      active: true,
      rules: [{ minAmount: '0', maxAmount: null, steps: [{ roleName: '' }] }],
    };
  }
  return {
    documentType: workflow.documentType as WorkflowFormInput['documentType'],
    name: workflow.name,
    active: workflow.active,
    rules: workflow.rules.map((rule) => ({
      minAmount: rule.minAmount,
      maxAmount: rule.maxAmount,
      steps: rule.steps.map((step) => ({ roleName: step.roleName })),
    })),
  };
}

type StepsProps = {
  ruleIndex: number;
  control: Control<WorkflowFormInput, unknown, WorkflowFormOutput>;
  register: UseFormRegister<WorkflowFormInput>;
  roleNames: string[] | null;
  error: string | undefined;
};

function StepFields({ ruleIndex, control, register, roleNames, error }: StepsProps) {
  const steps = useFieldArray({ control, name: `rules.${ruleIndex}.steps` });
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium">Approval steps, in order</p>
      <ol className="space-y-1.5">
        {steps.fields.map((field, stepIndex) => (
          <li key={field.id} className="flex items-center gap-1.5">
            <span className="num flex size-6 shrink-0 items-center justify-center rounded-full border border-border bg-surface-muted text-xs font-medium">
              {stepIndex + 1}
            </span>
            {roleNames ? (
              <Select
                aria-label={`Step ${stepIndex + 1} role`}
                {...register(`rules.${ruleIndex}.steps.${stepIndex}.roleName`)}
              >
                <option value="">Choose a role</option>
                {roleNames.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </Select>
            ) : (
              <Input
                aria-label={`Step ${stepIndex + 1} role`}
                placeholder="Role name"
                {...register(`rules.${ruleIndex}.steps.${stepIndex}.roleName`)}
              />
            )}
            <IconButton
              label="Move step up"
              size="sm"
              disabled={stepIndex === 0}
              onClick={() => steps.swap(stepIndex, stepIndex - 1)}
            >
              <ArrowUp className="size-3.5" aria-hidden />
            </IconButton>
            <IconButton
              label="Move step down"
              size="sm"
              disabled={stepIndex === steps.fields.length - 1}
              onClick={() => steps.swap(stepIndex, stepIndex + 1)}
            >
              <ArrowDown className="size-3.5" aria-hidden />
            </IconButton>
            <IconButton
              label="Remove step"
              size="sm"
              disabled={steps.fields.length === 1}
              onClick={() => steps.remove(stepIndex)}
            >
              <Trash2 className="size-3.5" aria-hidden />
            </IconButton>
          </li>
        ))}
      </ol>
      {error ? <p className="text-xs font-medium text-danger">{error}</p> : null}
      <Button size="sm" variant="ghost" onClick={() => steps.append({ roleName: '' })}>
        <Plus className="size-3.5" aria-hidden />
        Add step
      </Button>
    </div>
  );
}

type FormProps = {
  workflow: WorkflowDto | null;
  initialType: string;
  existingTypes: string[];
  onDone: () => void;
};

function WorkflowForm({ workflow, initialType, existingTypes, onDone }: FormProps) {
  const upsert = useUpsertWorkflow();
  const roles = useRoles();
  const [formError, setFormError] = React.useState<string | null>(null);
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<WorkflowFormInput, unknown, WorkflowFormOutput>({
    resolver: zodResolver(workflowFormSchema),
    defaultValues: toFormValues(workflow, initialType),
  });
  const rules = useFieldArray({ control, name: 'rules' });
  const roleNames = roles.data ? roles.data.map((role) => role.name) : null;
  const available = APPROVAL_DOCUMENT_TYPES.filter(
    (type) => !existingTypes.includes(type) || type === workflow?.documentType,
  );

  function onSubmit(values: WorkflowFormOutput): void {
    if (upsert.isPending) return;
    setFormError(null);
    upsert.mutate(
      {
        ...values,
        rules: values.rules.map((rule) => ({
          minAmount: rule.minAmount,
          maxAmount: rule.maxAmount ?? null,
          steps: rule.steps,
        })),
      },
      {
        onSuccess: () => {
          toast.success(
            'Workflow saved',
            'New submissions use these bands and steps. Requests already pending keep their original steps.',
          );
          onDone();
        },
        onError: (error) =>
          setFormError(applyServerErrors(error, setError, ['documentType', 'name', 'rules'])),
      },
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex min-h-0 flex-1 flex-col">
      <DialogBody className="space-y-5">
        {formError ? <Alert tone="danger">{formError}</Alert> : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Document type" required error={errors.documentType?.message}>
            {(field) => (
              <Select {...field} disabled={workflow !== null} {...register('documentType')}>
                {available.map((type) => (
                  <option key={type} value={type}>
                    {documentTypeLabel(type)}
                  </option>
                ))}
              </Select>
            )}
          </FormField>
          <FormField label="Workflow name" required error={errors.name?.message}>
            {(field) => <Input {...field} {...register('name')} />}
          </FormField>
        </div>
        <Controller
          control={control}
          name="active"
          render={({ field }) => (
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={field.value} onCheckedChange={field.onChange} />
              Active. When off, documents of this type are approved without steps.
            </label>
          )}
        />

        <div className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold">Amount bands</h3>
            <p className="text-xs text-muted-foreground">
              The band whose range contains the document total decides the steps. Leave the upper
              limit empty for no ceiling.
            </p>
          </div>
          {typeof errors.rules?.message === 'string' ? (
            <p className="text-xs font-medium text-danger">{errors.rules.message}</p>
          ) : null}
          {rules.fields.map((field, ruleIndex) => (
            <fieldset
              key={field.id}
              className="space-y-3 rounded-lg border border-border bg-surface-muted/40 p-3"
            >
              <legend className="px-1 text-xs font-medium text-muted-foreground">
                Band {ruleIndex + 1}
              </legend>
              <div className="grid gap-3 sm:grid-cols-2">
                <FormField label="From (PHP)" error={errors.rules?.[ruleIndex]?.minAmount?.message}>
                  {(input) => (
                    <Controller
                      control={control}
                      name={`rules.${ruleIndex}.minAmount`}
                      render={({ field: amount }) => (
                        <CurrencyInput
                          {...input}
                          value={String(amount.value ?? '')}
                          onChange={amount.onChange}
                        />
                      )}
                    />
                  )}
                </FormField>
                <FormField
                  label="Up to (PHP)"
                  error={errors.rules?.[ruleIndex]?.maxAmount?.message}
                >
                  {(input) => (
                    <Controller
                      control={control}
                      name={`rules.${ruleIndex}.maxAmount`}
                      render={({ field: amount }) => (
                        <CurrencyInput
                          {...input}
                          value={amount.value == null ? '' : String(amount.value)}
                          onChange={(next) => amount.onChange(next === '' ? null : next)}
                          placeholder="No limit"
                        />
                      )}
                    />
                  )}
                </FormField>
              </div>
              <StepFields
                ruleIndex={ruleIndex}
                control={control}
                register={register}
                roleNames={roleNames}
                error={
                  errors.rules?.[ruleIndex]?.steps?.message ??
                  errors.rules?.[ruleIndex]?.steps?.root?.message
                }
              />
              {rules.fields.length > 1 ? (
                <Button size="sm" variant="ghost" onClick={() => rules.remove(ruleIndex)}>
                  <Trash2 className="size-3.5" aria-hidden />
                  Remove band
                </Button>
              ) : null}
            </fieldset>
          ))}
          <Button
            size="sm"
            onClick={() =>
              rules.append({ minAmount: '', maxAmount: null, steps: [{ roleName: '' }] })
            }
          >
            <Plus className="size-3.5" aria-hidden />
            Add band
          </Button>
        </div>
      </DialogBody>
      <DialogFooter>
        <Button onClick={onDone} disabled={upsert.isPending}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" loading={upsert.isPending}>
          Save workflow
        </Button>
      </DialogFooter>
    </form>
  );
}

export type WorkflowDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workflow: WorkflowDto | null;
  existingTypes: string[];
};

export function WorkflowDialog({
  open,
  onOpenChange,
  workflow,
  existingTypes,
}: WorkflowDialogProps) {
  const firstFree =
    APPROVAL_DOCUMENT_TYPES.find((type) => !existingTypes.includes(type)) ??
    APPROVAL_DOCUMENT_TYPES[0];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>
            {workflow
              ? `Edit ${documentTypeLabel(workflow.documentType)} workflow`
              : 'New approval workflow'}
          </DialogTitle>
          <DialogDescription>
            Choose who must approve, in what order, for each range of document amounts.
          </DialogDescription>
        </DialogHeader>
        {open ? (
          <WorkflowForm
            key={workflow?.id ?? 'new'}
            workflow={workflow}
            initialType={firstFree}
            existingTypes={existingTypes}
            onDone={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
