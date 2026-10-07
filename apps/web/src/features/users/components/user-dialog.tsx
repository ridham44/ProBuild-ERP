'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Copy, Wand2 } from 'lucide-react';
import * as React from 'react';
import { Controller, useForm } from 'react-hook-form';
import { FormField } from '@/components/common/form-field';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
import { useRoles } from '@/features/roles/api/hooks';
import { applyServerErrors } from '@/lib/forms';
import { copyToClipboard } from '@/lib/clipboard';
import { generateTemporaryPassword } from '@/lib/password';
import { PasswordPolicy } from '@/features/auth/components/password-policy';
import { useCreateUser } from '../api/hooks';
import { userFormSchema, type UserFormValues } from '../schemas';

const FIELDS = ['email', 'name', 'password', 'roleIds'] as const;

function UserForm({ onDone, canListRoles }: { onDone: () => void; canListRoles: boolean }) {
  const create = useCreateUser();
  const roles = useRoles(canListRoles);
  const [formError, setFormError] = React.useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    watch,
    control,
    formState: { errors },
  } = useForm<UserFormValues>({
    resolver: zodResolver(userFormSchema),
    defaultValues: { email: '', name: '', password: '', roleIds: [] },
  });
  const password = watch('password');

  function onSubmit(values: UserFormValues): void {
    if (create.isPending) return;
    setFormError(null);
    create.mutate(
      { ...values, userType: 'INTERNAL', roleIds: values.roleIds ?? [] },
      {
        onSuccess: (user) => {
          toast.success(
            `${user.name} was added`,
            'They must set their own password at first sign-in.',
          );
          onDone();
        },
        onError: (error) => setFormError(applyServerErrors(error, setError, FIELDS)),
      },
    );
  }

  async function copyPassword(): Promise<void> {
    const copied = await copyToClipboard(password);
    if (copied) toast.info('Temporary password copied');
    else toast.error('Could not copy', 'Select the password and copy it manually.');
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex min-h-0 flex-1 flex-col">
      <DialogBody className="space-y-4">
        {formError ? <Alert tone="danger">{formError}</Alert> : null}
        <Alert tone="info">
          The password below is temporary. The user is required to choose their own the first time
          they sign in.
        </Alert>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Full name" required error={errors.name?.message}>
            {(field) => <Input {...field} autoFocus {...register('name')} />}
          </FormField>
          <FormField label="Work email" required error={errors.email?.message}>
            {(field) => <Input {...field} type="email" spellCheck={false} {...register('email')} />}
          </FormField>
        </div>
        <FormField label="Temporary password" required error={errors.password?.message}>
          {(field) => (
            <div className="flex gap-2">
              <Input
                {...field}
                className="font-mono"
                autoComplete="off"
                spellCheck={false}
                {...register('password')}
              />
              <Button
                onClick={() =>
                  setValue('password', generateTemporaryPassword(), { shouldValidate: true })
                }
                aria-label="Generate a password"
              >
                <Wand2 className="size-3.5" aria-hidden />
                <span className="hidden sm:inline">Generate</span>
              </Button>
              <Button
                onClick={() => void copyPassword()}
                disabled={!password}
                aria-label="Copy password"
              >
                <Copy className="size-3.5" aria-hidden />
              </Button>
            </div>
          )}
        </FormField>
        <PasswordPolicy password={password} />

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Roles</legend>
          {!canListRoles ? (
            <p className="text-sm text-muted-foreground">
              Your role cannot view the role list, so roles can be assigned later by an
              administrator.
            </p>
          ) : roles.isPending ? (
            <p className="text-sm text-muted-foreground">Loading roles</p>
          ) : roles.isError ? (
            <p className="text-sm text-danger">
              Roles could not be loaded. You can assign them after the user is created.
            </p>
          ) : (
            <Controller
              control={control}
              name="roleIds"
              render={({ field }) => (
                <div className="grid max-h-44 gap-1.5 overflow-y-auto rounded border border-border p-2 sm:grid-cols-2">
                  {roles.data.map((role) => {
                    const checked = (field.value ?? []).includes(role.id);
                    return (
                      <label
                        key={role.id}
                        className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-surface-muted"
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(next) =>
                            field.onChange(
                              next === true
                                ? [...(field.value ?? []), role.id]
                                : (field.value ?? []).filter((id) => id !== role.id),
                            )
                          }
                        />
                        {role.name}
                      </label>
                    );
                  })}
                </div>
              )}
            />
          )}
          <p className="text-xs text-muted-foreground">
            Roles you do not hold yourself cannot be granted; the server will tell you if a choice
            is not allowed.
          </p>
        </fieldset>
      </DialogBody>
      <DialogFooter>
        <Button onClick={onDone} disabled={create.isPending}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" loading={create.isPending}>
          Create user
        </Button>
      </DialogFooter>
    </form>
  );
}

export function UserDialog({
  open,
  onOpenChange,
  canListRoles,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canListRoles: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>New user</DialogTitle>
          <DialogDescription>
            Create an internal staff account and hand over the temporary password in person or
            through a secure channel.
          </DialogDescription>
        </DialogHeader>
        {open ? <UserForm onDone={() => onOpenChange(false)} canListRoles={canListRoles} /> : null}
      </DialogContent>
    </Dialog>
  );
}
