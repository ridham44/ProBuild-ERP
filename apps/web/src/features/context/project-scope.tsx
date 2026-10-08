'use client';

import { FolderKanban, X } from 'lucide-react';
import * as React from 'react';
import { useProject } from '@/features/projects/api/hooks';
import { useWorkContext } from './work-context';

/**
 * The project selected in the top bar, applied to a list as a filter. A page can still show everything
 * by dismissing the chip, without losing the chosen project for the other pages.
 */
export function useProjectScope() {
  const { projectId } = useWorkContext();
  const [dismissedFor, setDismissedFor] = React.useState<string | null>(null);
  const active = projectId !== null && dismissedFor !== projectId ? projectId : null;
  const project = useProject(active ?? '', active !== null);
  return {
    /** Project id to filter by, or undefined when the list is not scoped. */
    projectId: active ?? undefined,
    label: project.data ? `${project.data.code} · ${project.data.name}` : 'Selected project',
    showAll: () => setDismissedFor(projectId),
  };
}

export function ProjectScopeChip({
  scope,
}: {
  scope: ReturnType<typeof useProjectScope>;
}) {
  if (!scope.projectId) return null;
  return (
    <span className="inline-flex h-8 items-center gap-1.5 rounded border border-primary-border bg-primary-subtle pl-2 pr-1 text-sm">
      <FolderKanban className="size-3.5 text-primary" aria-hidden />
      <span className="max-w-56 truncate">{scope.label}</span>
      <button
        type="button"
        onClick={scope.showAll}
        className="rounded p-0.5 text-muted-foreground hover:bg-surface hover:text-foreground"
        aria-label="Show all projects"
      >
        <X className="size-3.5" aria-hidden />
      </button>
    </span>
  );
}
