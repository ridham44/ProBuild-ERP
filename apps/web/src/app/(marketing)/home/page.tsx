import type { Metadata } from 'next';
import { getServerSession } from '@/features/auth/server';
import { MarketingHome } from '@/features/marketing/components/marketing-home';

export const metadata: Metadata = {
  title: 'Construction ERP for project cost, procurement and inventory',
  description:
    'ProBuild ERP: one ledger from the first purchase request to the project cost. Procurement, receiving, inventory and project costs, connected. Try the live demo.',
};

export default async function HomePage() {
  const session = await getServerSession();
  return <MarketingHome signedIn={session.status === 'ok'} />;
}
