import type { Metadata } from 'next';
import Link from 'next/link';
import { ChangePasswordForm } from '@/features/auth/components/change-password-form';
import { getServerSession } from '@/features/auth/server';

export const metadata: Metadata = { title: 'Change password' };

export default async function ChangePasswordPage() {
  const session = await getServerSession();
  const forced = session.status === 'ok' && session.user.mustChangePassword;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {forced ? 'Set a new password to continue' : 'Change password'}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {forced
            ? 'Your administrator issued a temporary password. Choose your own before using ProBuild.'
            : 'Changing your password signs you out of every other device.'}
        </p>
      </div>
      <ChangePasswordForm forced={forced} />
      {forced ? null : (
        <p className="text-center text-sm">
          <Link href="/" className="text-muted-foreground hover:text-foreground hover:underline">
            Back to dashboard
          </Link>
        </p>
      )}
    </div>
  );
}
