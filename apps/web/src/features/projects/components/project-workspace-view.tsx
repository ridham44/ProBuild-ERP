'use client';

import type { ProjectStatusKey } from '@probuild/shared';
import { ChevronDown, Pencil } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';
import { ActivityPanel } from '@/components/common/activity-panel';
import { QueryErrorState } from '@/components/common/error-state';
import { PageHeader } from '@/components/common/page-header';
import { Panel } from '@/components/common/panel';
import { ReasonDialog } from '@/components/common/reason-dialog';
import { StatusBadge } from '@/components/common/status-badge';
import { UrlTabs } from '@/components/common/url-tabs';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/toast';
import { useCan } from '@/features/auth/components/current-user';
import { PermissionGate } from '@/features/auth/components/permission-gate';
import { errorMessage } from '@/lib/api/errors';
import type { ProjectDetail } from '@/lib/api/types';
import { formatPHP } from '@/lib/format';
import {
  useChangeProjectStatus,
  useProject,
  useProjectActivity,
  useProjectDashboard,
} from '../api/hooks';
import { allowedTransitions, transitionCopy } from '../model';
import { ProgressBar } from './progress-bar';
import { ProjectBoq } from './project-boq';
import { ProjectEditDrawer } from './project-edit-drawer';
import { ProjectFinancial } from './project-financial';
import { ProjectOverview } from './project-overview';
import { ProjectProcurement } from './project-procurement';
import { ProjectTeam } from './project-team';
import { ProjectWbs } from './project-wbs';

function HeaderFacts({ project }: { project: ProjectDetail }) {
  const dashboard = useProjectDashboard(project.id);
  const contractValue = dashboard.data?.financial?.contractValue ?? project.contractAmount;
  return (
    <dl className="mb-5 grid gap-x-8 gap-y-3 rounded-lg border border-border bg-surface px-4 py-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
      <div>
        <dt className="text-xs text-muted-foreground">Client</dt>
        <dd className="mt-0.5 font-medium">
          <Link href={`/customers/${project.customerId}`} className="hover:underline">
            {project.customer.name}
          </Link>
        </dd>
      </div>
      <div>
        <dt className="text-xs text-muted-foreground">Project manager</dt>
        <dd className="mt-0.5 font-medium">{project.manager?.name ?? 'Unassigned'}</dd>
      </div>
      <div>
        <dt className="text-xs text-muted-foreground">Contract value</dt>
        <dd className="num mt-0.5 font-medium">{formatPHP(contractValue)}</dd>
      </div>
      <div>
        <dt className="text-xs text-muted-foreground">Physical progress</dt>
        <dd className="mt-1.5">
          <ProgressBar value={project.progressPct} label="Project progress" />
        </dd>
      </div>
    </dl>
  );
}

export function ProjectWorkspaceView({ id }: { id: string }) {
  const project = useProject(id);
  const canEdit = useCan('projects.project', 'EDIT', { projectId: id });
  const canSeeWbs = useCan('projects.wbs', 'VIEW', { projectId: id });
  const canSeeBoq = useCan('projects.boq', 'VIEW', { projectId: id });
  const canSeeBudget = useCan('projects.budget', 'VIEW', { projectId: id });
  const canSeeReq = useCan('procurement.requisition', 'VIEW', { projectId: id });
  const activity = useProjectActivity(id);
  const changeStatus = useChangeProjectStatus(id);
  const [editOpen, setEditOpen] = React.useState(false);
  const [target, setTarget] = React.useState<ProjectStatusKey | null>(null);
  const [statusError, setStatusError] = React.useState<string | null>(null);
  const data = project.data;

  function confirmStatus(reason: string): void {
    if (!target) return;
    setStatusError(null);
    changeStatus.mutate(
      { status: target, ...(reason ? { reason } : {}) },
      {
        onSuccess: () => {
          toast.success('Project status updated');
          setTarget(null);
        },
        onError: (error) => setStatusError(errorMessage(error)),
      },
    );
  }

  const transitions = data ? allowedTransitions(data.status) : [];
  const copy = target ? transitionCopy(target) : null;

  return (
    <PermissionGate module="projects.project">
      {project.isPending ? (
        <div className="space-y-4" role="status" aria-label="Loading project">
          <Skeleton className="h-7 w-72" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : project.isError || !data ? (
        <QueryErrorState error={project.error} onRetry={() => void project.refetch()} />
      ) : (
        <>
          <PageHeader
            title={data.name}
            breadcrumbs={[{ label: 'Projects', href: '/projects' }, { label: data.code }]}
            meta={
              <>
                <span className="font-mono text-xs text-muted-foreground">{data.code}</span>
                <StatusBadge status={data.status} />
              </>
            }
            actions={
              canEdit ? (
                <>
                  {transitions.length > 0 ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button>
                          Change status
                          <ChevronDown className="size-3" aria-hidden />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {transitions.map((status) => (
                          <DropdownMenuItem key={status} onSelect={() => setTarget(status)}>
                            {transitionCopy(status).label}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : null}
                  <Button variant="primary" onClick={() => setEditOpen(true)}>
                    <Pencil className="size-3.5" aria-hidden />
                    Edit
                  </Button>
                </>
              ) : null
            }
          />
          <HeaderFacts project={data} />
          <UrlTabs
            label="Project workspace"
            tabs={[
              { id: 'overview', label: 'Overview', content: <ProjectOverview project={data} /> },
              ...(canSeeBudget || canSeeBoq
                ? [{ id: 'financial', label: 'Financial', content: <ProjectFinancial project={data} canSeeBudget={canSeeBudget} /> }]
                : []),
              ...(canSeeBoq ? [{ id: 'boq', label: 'BOQ', content: <ProjectBoq project={data} /> }] : []),
              ...(canSeeWbs ? [{ id: 'wbs', label: 'WBS', content: <ProjectWbs project={data} /> }] : []),
              ...(canSeeReq ? [{ id: 'procurement', label: 'Procurement', content: <ProjectProcurement projectId={id} /> }] : []),
              { id: 'team', label: 'Team', content: <ProjectTeam project={data} canEdit={canEdit} /> },
              {
                id: 'activity',
                label: 'Activity',
                content: (
                  <Panel>
                    <ActivityPanel
                      items={activity.data}
                      loading={activity.isPending}
                      error={activity.error}
                      onRetry={() => void activity.refetch()}
                    />
                  </Panel>
                ),
              },
            ]}
          />
          <ProjectEditDrawer open={editOpen} onOpenChange={setEditOpen} project={data} />
          <ReasonDialog
            open={target !== null}
            onOpenChange={(open) => (open ? undefined : setTarget(null))}
            title={copy?.title ?? ''}
            description={copy?.description ?? ''}
            confirmLabel={copy?.label ?? 'Confirm'}
            tone={copy?.danger ? 'danger' : 'primary'}
            required={copy?.reasonRequired ?? false}
            fieldLabel={copy?.reasonRequired ? 'Reason' : 'Note (optional)'}
            loading={changeStatus.isPending}
            error={statusError}
            onConfirm={confirmStatus}
          />
        </>
      )}
    </PermissionGate>
  );
}
