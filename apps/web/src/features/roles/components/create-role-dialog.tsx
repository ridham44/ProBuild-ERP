'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
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
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/toast';
import { applyServerErrors } from '@/lib/forms';
import { useCreateRole } from '../api/hooks';

const roleFormSchema = z.object({
  name: z.string().trim().min(2, 'Use at least 2 characters').max(60),
  description: z.string().max(200).optional(),
});
type RoleFormValues = z.input<typeof roleFormSchema>;

function RoleForm({ onDone, onCreated }: { onDone: () => void; onCreated: (id: string) => void }) {
  const create = useCreateRole();
  const [formError, setFormError] = React.useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<RoleFormValues>({
    resolver: zodResolver(roleFormSchema),
    defaultValues: { name: '', description: '' },
  });

  function onSubmit(values: RoleFormValues): void {
    if (create.isPending) return;
    setFormError(null);
    create.mutate(
      {
        name: values.name,
        ...(values.description?.trim() ? { description: values.description.trim() } : {}),
      },
      {
        onSuccess: (role) => {
          toast.success(
            `${role.name} created`,
            'It has no permissions yet. Edit the role to grant some.',
          );
          onCreated(role.id);
          onDone();
        },
        onError: (error) =>
          setFormError(applyServerErrors(error, setError, ['name', 'description'])),
      },
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex min-h-0 flex-1 flex-col">
      <DialogBody className="space-y-4">
        {formError ? <Alert tone="danger">{formError}</Alert> : null}
        <FormField label="Role name" required error={errors.name?.message}>
          {(control) => <Input {...control} autoFocus {...register('name')} />}
        </FormField>
        <FormField
          label="Description"
          error={errors.description?.message}
          hint="Optional. Say who this role is for."
        >
          {(control) => <Input {...control} {...register('description')} />}
        </FormField>
      </DialogBody>
      <DialogFooter>
        <Button onClick={onDone} disabled={create.isPending}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" loading={create.isPending}>
          Create role
        </Button>
      </DialogFooter>
    </form>
  );
}

export function CreateRoleDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (id: string) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>New role</DialogTitle>
          <DialogDescription>
            Start with a name. Permissions are added afterwards in the matrix.
          </DialogDescription>
        </DialogHeader>
        {open ? <RoleForm onDone={() => onOpenChange(false)} onCreated={onCreated} /> : null}
      </DialogContent>
    </Dialog>
  );
}
