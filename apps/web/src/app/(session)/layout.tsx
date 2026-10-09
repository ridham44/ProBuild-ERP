import { redirect } from 'next/navigation';
import { BrandMark } from '@/components/common/brand-mark';
import { getServerSession } from '@/features/auth/server';

/** Focused pages for signed-in users who must act before using the app (no navigation chrome). */
export default async function SessionLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession();
  if (session.status === 'unauthenticated') redirect('/login?reason=expired&next=/change-password');
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-4 py-10">
      <div className="mb-6 flex items-center gap-2.5">
        <BrandMark className="size-8 rounded-lg" />
        <span className="text-lg font-semibold tracking-tight">ProBuild</span>
      </div>
      <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-6 shadow-card sm:p-8">
        {children}
      </div>
    </div>
  );
}
