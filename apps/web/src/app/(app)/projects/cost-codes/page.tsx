import type { Metadata } from 'next';
import { CostCodesView } from '@/features/projects/components/cost-codes-view';

export const metadata: Metadata = { title: 'Cost codes' };

export default function Page() {
  return <CostCodesView />;
}
