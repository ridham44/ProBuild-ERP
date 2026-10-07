import type { Metadata } from 'next';
import { PeriodsView } from '@/features/accounting/components/periods-view';

export const metadata: Metadata = { title: 'Accounting periods' };

export default function AccountingPeriodsPage() {
  return <PeriodsView />;
}
