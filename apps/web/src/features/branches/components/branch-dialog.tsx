'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { FormField } from '@/components/common/form-field';
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
import { Input, Textarea } from '@/components/ui/input';
import { toast } from '@/components/ui/toast';
import type { BranchDto } from '@/lib/api/contract';
import { applyServerErrors } from '@/lib/forms';
import { useCreateBranch, useUpdateBranch } from '../api/hooks';
import { branchFormSchema, type BranchFormValues } from '../schemas';

const FIELDS = ['code', 'name', 'address'] as const;

export type BranchDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Null creates a new branch; a branch edits it. */
  branch: BranchDto | null;
};

function BranchForm({ branch, onDone }: { branch: BranchDto | null; onDone: () => void }) {
  const create = useCreateBranch();
  const update = useUpdateBranch();
  const [formError, setFormError] = React.useState<string | null>(null);
  const pending = create.isPending || update.isPending;
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<BranchFormValues>({
    resolver: zodResolver(branchFormSchema),
    defaultValues: {
      code: branch?.code ?? '',
      name: branch?.name ?? '',
      address: branch?.address ?? '',
    },
  });

  function onSubmit(values: BranchFormValues): void {
    if (pending) return;
    setFormError(null);
    const body = { ...values, address: values.address?.trim() ? values.address : null };
    const options = {
      onSuccess: () => {
        toast.success(branch ? 'Branch updated' : 'Branch created');
        onDone();
      },
      onError: (error: unknown) => setFormError(applyServerErrors(error, setError, FIELDS)),
    };
    if (branch) update.mutate({ id: branch.id, body }, options);
    else create.mutate(body, options);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex min-h-0 flex-1 flex-col">
      <DialogBody className="space-y-4">
        {formError ? <Alert tone="danger">{formError}</Alert> : null}
        <div className="grid gap-4 sm:grid-cols-[8rem_1fr]">
          <FormField
            label="Code"
            required
            error={errors.code?.message}
            hint="Short and unique, e.g. MNL."
          >
            {(control) => (
              <Input {...control} autoFocus className="font-mono" {...register('code')} />
            )}
          </FormField>
          <FormField label="Name" required error={errors.name?.message}>
            {(control) => <Input {...control} {...register('name')} />}
          </FormField>
        </div>
        <FormField label="Address" error={errors.address?.message}>
          {(control) => <Textarea {...control} rows={2} {...register('address')} />}
        </FormField>
      </DialogBody>
      <DialogFooter>
        <Button onClick={onDone} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" loading={pending}>
          {branch ? 'Save changes' : 'Create branch'}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function BranchDialog({ open, onOpenChange, branch }: BranchDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>{branch ? `Edit ${branch.name}` : 'New branch'}</DialogTitle>
          <DialogDescription>
            {branch
              ? 'Changes apply to new documents; existing records keep their branch.'
              : 'Branches group warehouses, projects and staff by office.'}
          </DialogDescription>
        </DialogHeader>
        <BranchForm key={branch?.id ?? 'new'} branch={branch} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}
