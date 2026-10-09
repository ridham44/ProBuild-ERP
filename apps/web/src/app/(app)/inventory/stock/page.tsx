import type { Metadata } from 'next';
import { StockView } from '@/features/stock/components/stock-view';

export const metadata: Metadata = { title: 'Stock on hand' };

export default function Page() {
  return <StockView />;
}
