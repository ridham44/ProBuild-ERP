import type { Metadata } from 'next';
import { RfqNewView } from '@/features/rfqs/components/rfq-new-view';

export const metadata: Metadata = { title: 'New RFQ' };

export default function Page() {
  return <RfqNewView />;
}
