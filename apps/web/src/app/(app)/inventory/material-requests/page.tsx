import type { Metadata } from 'next';
import { MaterialRequestsView } from '@/features/material-requests/components/material-requests-view';

export const metadata: Metadata = { title: 'Material requests' };

export default function Page() {
  return <MaterialRequestsView />;
}
