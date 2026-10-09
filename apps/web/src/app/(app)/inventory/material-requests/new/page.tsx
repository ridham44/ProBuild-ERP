import type { Metadata } from 'next';
import { MaterialRequestNewView } from '@/features/material-requests/components/material-request-new-view';

export const metadata: Metadata = { title: 'New material request' };

export default function Page() {
  return <MaterialRequestNewView />;
}
