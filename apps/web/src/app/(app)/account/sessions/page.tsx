import type { Metadata } from 'next';
import { SessionsView } from '@/features/auth/components/sessions-view';

export const metadata: Metadata = { title: 'Sessions and devices' };

export default function SessionsPage() {
  return <SessionsView />;
}
