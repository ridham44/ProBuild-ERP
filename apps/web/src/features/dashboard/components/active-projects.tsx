'use client';

import { AlertTriangle, ArrowRight, FolderKanban } from 'lucide-react';
import Link from 'next/link';
import { EmptyState } from '@/components/common/empty-state';
import { QueryErrorState } from '@/components/common/error-state';
import { Meter } from '@/components/common/meter';
import { Panel } from '@/components/common/panel';
import { Button } from '@/components/ui/button';
import { SkeletonLines } from '@/components/ui/skeleton';
import { useProjects } from '@/features/projects/api/hooks';
import { projectProgressTone } from '@/features/projects/components/progress-bar';
import { isProjectOverdue, projectTargetFinish } from '@/features/projects/model';
import type { ProjectRow } from '@/lib/api/types';
import { formatDate, formatPHP } from '@/lib/format';

function ProjectLine({ project }: { project: ProjectRow }) {
  const overdue = isProjectOverdue(project);
  return (
    <li className="grid gap-x-6 gap-y-2 px-5 py-3.5 sm:grid-cols-[minmax(0,1fr)_10rem_8.5rem] sm:items-center">
      <div className="min-w-0">
        <Link
          href={`/projects/${project.id}`}
          className="block truncate font-medium text-foreground hover:text-primary hover:underline"
        >
          {project.name}
        </Link>
        <p className="truncate text-xs text-muted-foreground">
          <span className="font-mono">{project.code}</span> · {project.customer.name}
        </p>
      </div>
      <Meter
        value={project.progressPct}
        label={`${project.name} progress`}
        tone={projectProgressTone(project)}
      />
      <div className="text-xs sm:text-right">
        <p className="num font-medium text-foreground">{formatPHP(project.contractAmount)}</p>
        <p className={overdue ? 'inline-flex items-center gap-1 font-medium text-danger' : 'text-muted-foreground'}>
          {overdue ? <AlertTriangle className="size-3" aria-hidden /> : null}
          {overdue ? 'Past finish ' : 'Finish '}
          {formatDate(projectTargetFinish(project))}
        </p>
      </div>
    </li>
  );
}

/** Active jobs with real progress and schedule state. Only shown to roles that can view projects. */
export function ActiveProjects() {
  const projects = useProjects({ status: 'ACTIVE', limit: 6 });
  const items = projects.data?.items ?? [];
  return (
    <Panel
      title="Active projects"
      description="Physical progress, contract value and target finish"
      actions={
        <Button asChild size="sm" variant="ghost">
          <Link href="/projects">
            All projects
            <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        </Button>
      }
      bodyClassName="p-0"
    >
      {projects.isPending ? (
        <SkeletonLines lines={4} className="p-5" />
      ) : projects.isError ? (
        <QueryErrorState error={projects.error} onRetry={() => void projects.refetch()} compact />
      ) : items.length === 0 ? (
        <EmptyState
          compact
          icon={FolderKanban}
          title="No active projects"
          description="Projects appear here once they move from pipeline to active."
        />
      ) : (
        <ul className="divide-y divide-border/70">
          {items.map((project) => (
            <ProjectLine key={project.id} project={project} />
          ))}
        </ul>
      )}
    </Panel>
  );
}
