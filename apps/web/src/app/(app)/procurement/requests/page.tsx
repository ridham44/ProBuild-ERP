import type { Metadata } from 'next';
import { RequisitionsView } from '@/features/requisitions/components/requisitions-view';

export const metadata: Metadata = { title: 'Purchase requisitions' };

export default function Page() {
  return <RequisitionsView />;
}
