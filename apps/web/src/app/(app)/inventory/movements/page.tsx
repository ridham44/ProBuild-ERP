import type { Metadata } from 'next';
import { MovementsView } from '@/features/stock/components/movements-view';

export const metadata: Metadata = { title: 'Stock movements' };

export default function Page() {
  return <MovementsView />;
}
