import type { Metadata } from 'next';
import Link from 'next/link';
import { ErrorState } from '@/components/common/error-state';
import { Button } from '@/components/ui/button';
import { ResetPasswordForm } from '@/features/auth/components/reset-password-form';

export const metadata: Metadata = { title: 'Reset password' };

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  if (!token) {
    return (
      <ErrorState
        compact
        title="This reset link is incomplete"
        description="Open the full link your administrator gave you, or ask them to issue a new one."
        action={
          <Button asChild>
            <Link href="/login">Back to sign in</Link>
          </Button>
        }
      />
    );
  }
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Choose a new password</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Reset links work once and expire after an hour. All your other sessions will be signed
          out.
        </p>
      </div>
      <ResetPasswordForm token={token} />
    </div>
  );
}
