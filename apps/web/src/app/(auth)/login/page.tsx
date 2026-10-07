import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { BrandMark } from '@/components/common/brand-mark';
import { LoginForm } from '@/features/auth/components/login-form';
import { getServerSession } from '@/features/auth/server';
import { safeNextPath } from '@/lib/safe-redirect';

export const metadata: Metadata = { title: 'Sign in' };

type SearchParams = Promise<{ next?: string; reason?: string; reset?: string }>;

export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const { next, reason, reset } = await searchParams;
  const destination = safeNextPath(next);
  const session = await getServerSession();
  if (session.status === 'ok')
    redirect(session.user.mustChangePassword ? '/change-password' : destination);

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <BrandMark className="size-8 lg:hidden" />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Use the work email your administrator registered.
          </p>
        </div>
      </div>
      <LoginForm
        next={destination}
        notice={reset === '1' ? 'reset' : reason === 'expired' ? 'expired' : null}
      />
    </div>
  );
}
