import type { Metadata } from 'next';
import { getServerSession } from '@/features/auth/server';
import {
  DemoSection,
  HomeFooter,
  HomeHero,
  HomeNav,
  ModulesSection,
  TrustStrip,
  WorkflowSection,
} from '@/features/marketing/components/home-sections';

export const metadata: Metadata = {
  title: 'Construction ERP for project cost, procurement and inventory',
  description:
    'ProBuild ERP: one ledger from the first purchase request to the final billing. Try the live demo.',
};

export default async function HomePage() {
  const session = await getServerSession();
  const signedIn = session.status === 'ok';

  return (
    <div className="min-h-dvh bg-background">
      <HomeNav signedIn={signedIn} />
      <main>
        <HomeHero
          primary={signedIn ? { href: '/', label: 'Open dashboard' } : { href: '#demo', label: 'Try the live demo' }}
          secondary={signedIn ? { href: '#modules', label: 'Explore modules' } : { href: '/login', label: 'Sign in' }}
        />
        <TrustStrip />
        <ModulesSection />
        <WorkflowSection />
        <DemoSection signedIn={signedIn} />
      </main>
      <HomeFooter />
    </div>
  );
}
