import type { Metadata } from 'next';
import { ItemsView } from '@/features/items/components/items-view';

export const metadata: Metadata = { title: 'Items' };

export default function Page() {
  return <ItemsView />;
}
