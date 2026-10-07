'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useHydrated } from '@/lib/use-hydrated';
import { FormField } from '@/components/common/form-field';
import { PasswordInput } from '@/components/common/password-input';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';
import { applyServerErrors } from '@/lib/forms';
import { useChangePassword } from '../api/hooks';
import { authKeys } from '../api/keys';
import { changePasswordFormSchema, type ChangePasswordFormValues } from '../schemas';
import { PasswordPolicy } from './password-policy';

export function ChangePasswordForm({ forced }: { forced: boolean }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const change = useChangePassword();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    watch,
    formState: { errors },
  } = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordFormSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  const submitting = change.isPending || change.isSuccess;
  const hydrated = useHydrated();

  function onSubmit(values: ChangePasswordFormValues): void {
    if (submitting) return;
    setFormError(null);
    change.mutate(
      { currentPassword: values.currentPassword, newPassword: values.newPassword },
      {
        onSuccess: async () => {
          await queryClient.invalidateQueries({ queryKey: authKeys.me() });
          toast.success('Password changed', 'Your other sessions were signed out.');
          router.replace('/');
          router.refresh();
        },
        onError: (error) =>
          setFormError(applyServerErrors(error, setError, ['currentPassword', 'newPassword'])),
      },
    );
  }

  return (
    <form method="post" onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      {formError ? <Alert tone="danger">{formError}</Alert> : null}
      <FormField label="Current password" error={errors.currentPassword?.message}>
        {(control) => (
          <PasswordInput
            {...control}
            autoComplete="current-password"
            autoFocus
            {...register('currentPassword')}
          />
        )}
      </FormField>
      <FormField label="New password" error={errors.newPassword?.message}>
        {(control) => (
          <PasswordInput {...control} autoComplete="new-password" {...register('newPassword')} />
        )}
      </FormField>
      <PasswordPolicy password={watch('newPassword')} />
      <FormField label="Confirm new password" error={errors.confirmPassword?.message}>
        {(control) => (
          <PasswordInput
            {...control}
            autoComplete="new-password"
            {...register('confirmPassword')}
          />
        )}
      </FormField>
      <Button
        type="submit"
        variant="primary"
        size="lg"
        className="w-full"
        loading={submitting}
        disabled={!hydrated}
      >
        {forced ? 'Save and continue' : 'Change password'}
      </Button>
    </form>
  );
}
