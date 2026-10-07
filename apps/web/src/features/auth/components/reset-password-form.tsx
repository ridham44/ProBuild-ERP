'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useHydrated } from '@/lib/use-hydrated';
import { FormField } from '@/components/common/form-field';
import { PasswordInput } from '@/components/common/password-input';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { applyServerErrors } from '@/lib/forms';
import { useConfirmPasswordReset } from '../api/hooks';
import { resetPasswordFormSchema, type ResetPasswordFormValues } from '../schemas';
import { PasswordPolicy } from './password-policy';

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const confirm = useConfirmPasswordReset();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    watch,
    formState: { errors },
  } = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordFormSchema),
    defaultValues: { newPassword: '', confirmPassword: '' },
  });

  const submitting = confirm.isPending || confirm.isSuccess;
  const hydrated = useHydrated();

  function onSubmit(values: ResetPasswordFormValues): void {
    if (submitting) return;
    setFormError(null);
    confirm.mutate(
      { token, newPassword: values.newPassword },
      {
        onSuccess: () => router.replace('/login?reset=1'),
        onError: (error) => setFormError(applyServerErrors(error, setError, ['newPassword'])),
      },
    );
  }

  return (
    <form method="post" onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      {formError ? <Alert tone="danger">{formError}</Alert> : null}
      <FormField label="New password" error={errors.newPassword?.message}>
        {(control) => (
          <PasswordInput
            {...control}
            autoComplete="new-password"
            autoFocus
            {...register('newPassword')}
          />
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
        Set new password
      </Button>
    </form>
  );
}
