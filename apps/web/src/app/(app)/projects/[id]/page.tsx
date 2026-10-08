import type { Metadata } from 'next';
import { ProjectWorkspaceView } from '@/features/projects/components/project-workspace-view';

export const metadata: Metadata = { title: 'Project' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ProjectWorkspaceView id={id} />;
}
