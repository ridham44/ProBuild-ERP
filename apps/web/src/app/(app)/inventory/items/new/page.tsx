import type { Metadata } from 'next';
import { ItemNewView } from '@/features/items/components/item-new-view';

export const metadata: Metadata = { title: 'New item' };

export default function Page() {
  return <ItemNewView />;
}
