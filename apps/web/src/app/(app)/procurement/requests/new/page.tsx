import type { Metadata } from 'next';
import { RequisitionNewView } from '@/features/requisitions/components/requisition-new-view';

export const metadata: Metadata = { title: 'New requisition' };

export default function Page() {
  return <RequisitionNewView />;
}
