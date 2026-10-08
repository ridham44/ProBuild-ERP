import type { Metadata } from 'next';
import { ProjectWizard } from '@/features/projects/components/project-wizard';

export const metadata: Metadata = { title: 'New project' };

export default function Page() {
  return <ProjectWizard />;
}
