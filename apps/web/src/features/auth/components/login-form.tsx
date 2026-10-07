'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, type LoginInput } from '@probuild/shared';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { useHydrated } from '@/lib/use-hydrated';
import { FormField } from '@/components/common/form-field';
import { PasswordInput } from '@/components/common/password-input';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { isApiError } from '@/lib/api/errors';
import { useLogin } from '../api/hooks';

export type LoginNotice = 'expired' | 'reset' | null;

/** One generic message for every credential failure, lockout included, so nothing about accounts leaks. */
export function loginErrorMessage(error: unknown): string {
  if (isApiError(error)) {
    if (error.status === 401)
      return 'The email or password is incorrect, or the account is temporarily unavailable. Check your details and try again.';
    if (error.status === 429)
      return 'Too many sign-in attempts. Please wait a minute and try again.';
    if (error.status >= 500) return 'Sign-in is unavailable right now. Please try again shortly.';
    return 'We could not sign you in. Check your details and try again.';
  }
  return 'Cannot reach the server. Check your connection and try again.';
}

export function LoginForm({ next, notice }: { next: string; notice: LoginNotice }) {
  const router = useRouter();
  const login = useLogin();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const submitting = login.isPending || login.isSuccess;
  const hydrated = useHydrated();

  function onSubmit(values: LoginInput): void {
    if (submitting) return;
    login.mutate(values, {
      onSuccess: (user) => {
        router.replace(user.mustChangePassword ? '/change-password' : next);
        router.refresh();
      },
    });
  }

  return (
    <form method="post" onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      {notice === 'expired' ? (
        <Alert tone="info">Your session ended. Sign in again to continue.</Alert>
      ) : null}
      {notice === 'reset' ? (
        <Alert tone="success">Your password was changed. Sign in with the new password.</Alert>
      ) : null}
      {login.isError ? <Alert tone="danger">{loginErrorMessage(login.error)}</Alert> : null}

      <FormField label="Email" error={errors.email ? 'Enter a valid email address' : undefined}>
        {(control) => (
          <Input
            {...control}
            type="email"
            autoComplete="username"
            autoFocus
            spellCheck={false}
            {...register('email')}
          />
        )}
      </FormField>
      <FormField label="Password" error={errors.password ? 'Enter your password' : undefined}>
        {(control) => (
          <PasswordInput {...control} autoComplete="current-password" {...register('password')} />
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
        {submitting ? 'Signing in' : 'Sign in'}
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        Forgot your password? Ask an administrator to issue a reset link.
      </p>
    </form>
  );
}
