import type { Metadata } from 'next';
import { QuotationsView } from '@/features/rfqs/components/quotations-view';

export const metadata: Metadata = { title: 'Quotations' };

export default function Page() {
  return <QuotationsView />;
}
