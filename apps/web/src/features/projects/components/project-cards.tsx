'use client';

import { AlertTriangle, MapPin, UserRound } from 'lucide-react';
import Link from 'next/link';
import { Meter } from '@/components/common/meter';
import { StatusBadge } from '@/components/common/status-badge';
import { Skeleton } from '@/components/ui/skeleton';
import type { ProjectRow } from '@/lib/api/types';
import { formatDate, formatPHP } from '@/lib/format';
import { isProjectOverdue, projectTargetFinish } from '../model';
import { projectProgressTone } from './progress-bar';

/**
 * Portfolio view: progress and schedule state up front, money and ownership underneath. It leaves out columns
 * that only matter when comparing rows, which the table view is better at.
 */
function ProjectCard({ project }: { project: ProjectRow }) {
  const overdue = isProjectOverdue(project);
  return (
    <li>
      <Link
        href={`/projects/${project.id}`}
        className="group/card flex h-full flex-col rounded-xl border border-border bg-surface p-4 shadow-card outline-none transition-[border-color,box-shadow] hover:border-border-strong hover:shadow-lift focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="doc-id text-muted-foreground">{project.code}</span>
          <StatusBadge status={project.status} />
        </div>
        <h3 className="mt-2 line-clamp-2 text-base font-semibold leading-snug group-hover/card:text-primary">
          {project.name}
        </h3>
        <p className="mt-1 truncate text-sm text-muted-foreground">{project.customer.name}</p>
        {project.location ? (
          <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-subtle-foreground">
            <MapPin className="size-3 shrink-0" aria-hidden />
            {project.location}
          </p>
        ) : null}
        <div className="mt-4">
          <div className="mb-1.5 flex items-baseline justify-between text-xs">
            <span className="text-muted-foreground">Physical progress</span>
          </div>
          <Meter value={project.progressPct} label={`${project.name} progress`} tone={projectProgressTone(project)} size="md" />
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-border/70 pt-3 text-xs">
          <div>
            <dt className="text-subtle-foreground">Contract value</dt>
            <dd className="num mt-0.5 text-sm font-semibold text-foreground">{formatPHP(project.contractAmount)}</dd>
          </div>
          <div className="text-right">
            <dt className="text-subtle-foreground">Target finish</dt>
            <dd className={overdue ? 'mt-0.5 inline-flex items-center gap-1 text-sm font-medium text-danger' : 'mt-0.5 text-sm font-medium text-foreground'}>
              {overdue ? <AlertTriangle className="size-3.5" aria-label="Past target finish" /> : null}
              {formatDate(projectTargetFinish(project))}
            </dd>
          </div>
        </dl>
        <p className="mt-auto flex items-center gap-1.5 pt-3 text-xs text-muted-foreground">
          <UserRound className="size-3.5" aria-hidden />
          {project.manager?.name ?? 'No manager assigned'}
        </p>
      </Link>
    </li>
  );
}

export function ProjectCards({ projects, loading }: { projects: ProjectRow[]; loading: boolean }) {
  if (loading) {
    return (
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" role="status" aria-label="Loading projects">
        {Array.from({ length: 6 }, (_, index) => (
          <li key={index}>
            <Skeleton className="h-60 rounded-xl" />
          </li>
        ))}
      </ul>
    );
  }
  return (
    <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label="Projects">
      {projects.map((project) => (
        <ProjectCard key={project.id} project={project} />
      ))}
    </ul>
  );
}
