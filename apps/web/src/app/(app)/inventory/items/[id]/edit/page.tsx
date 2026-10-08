import type { Metadata } from 'next';
import { ItemEditView } from '@/features/items/components/item-edit-view';

export const metadata: Metadata = { title: 'Edit item' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ItemEditView id={id} />;
}
