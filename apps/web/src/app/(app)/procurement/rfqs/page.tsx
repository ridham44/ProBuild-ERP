import type { Metadata } from 'next';
import { RfqsView } from '@/features/rfqs/components/rfqs-view';

export const metadata: Metadata = { title: 'RFQs' };

export default function Page() {
  return <RfqsView />;
}
