import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { ErrorState } from '@/components/common/error-state';
import { Button } from '@/components/ui/button';
import { getServerSession } from '@/features/auth/server';
import { AppShell } from '@/features/shell/components/app-shell';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession();
  if (session.status === 'unauthenticated') {
    const pathname = (await headers()).get('x-pathname') ?? '/';
    redirect(`/login?reason=expired&next=${encodeURIComponent(pathname)}`);
  }
  if (session.status === 'unavailable') {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <ErrorState
          kind="server"
          title="ProBuild cannot reach its server"
          description="The service did not respond. Wait a moment and reload the page."
          action={
            <Button asChild variant="primary">
              <a href="">Reload</a>
            </Button>
          }
        />
      </div>
    );
  }
  if (session.user.mustChangePassword) redirect('/change-password');
  return <AppShell initialUser={session.user}>{children}</AppShell>;
}
