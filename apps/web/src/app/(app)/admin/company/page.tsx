import type { Metadata } from 'next';
import { CompanyView } from '@/features/company/components/company-view';

export const metadata: Metadata = { title: 'Company' };

export default function CompanyPage() {
  return <CompanyView />;
}
