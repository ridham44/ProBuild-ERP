'use client';

import { Building2, Check, ChevronDown, FolderKanban, GitBranch } from 'lucide-react';
import * as React from 'react';
import { SearchInput } from '@/components/common/search-input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useProjects } from '@/features/projects/api/hooks';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip } from '@/components/ui/tooltip';
import { useCurrentUser } from '@/features/auth/components/current-user';
import { canUser } from '@/features/auth/permissions';
import { useBranches } from '@/features/branches/api/hooks';
import { useCompany } from '@/features/company/api/hooks';
import { useWorkContext } from '@/features/context/work-context';

function CompanyLabel() {
  const user = useCurrentUser();
  const allowed = canUser(user, 'organization.company', 'VIEW');
  const company = useCompany(allowed);
  const name = company.data ? (company.data.tradeName ?? company.data.legalName) : null;
  if (!name) return null;
  return (
    <Tooltip content="Your company. Switching between companies is not available yet.">
      <span className="hidden h-8 max-w-56 items-center gap-1.5 rounded border border-border bg-surface px-2.5 text-sm font-medium lg:inline-flex">
        <Building2 className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
        <span className="truncate">{name}</span>
      </span>
    </Tooltip>
  );
}

function BranchSelect() {
  const user = useCurrentUser();
  const allowed = canUser(user, 'organization.branch', 'VIEW');
  const { branchId, setBranchId } = useWorkContext();
  const branches = useBranches({ limit: 100 }, allowed);
  const active = branches.data?.items.filter((branch) => branch.active) ?? [];
  if (!allowed || active.length === 0) return null;
  const selected = active.find((branch) => branch.id === branchId);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="md"
          variant="secondary"
          aria-label={`Branch: ${selected?.name ?? 'All branches'}`}
          className="max-w-48"
        >
          <GitBranch className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
          <span className="hidden truncate sm:inline">{selected?.name ?? 'All branches'}</span>
          <ChevronDown className="size-3 shrink-0 text-muted-foreground" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-80 overflow-y-auto">
        <DropdownMenuLabel>Branch</DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => setBranchId(null)}>
          <Check className={branchId === null ? 'size-3.5' : 'size-3.5 opacity-0'} aria-hidden />
          All branches
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {active.map((branch) => (
          <DropdownMenuItem key={branch.id} onSelect={() => setBranchId(branch.id)}>
            <Check
              className={branchId === branch.id ? 'size-3.5' : 'size-3.5 opacity-0'}
              aria-hidden
            />
            <span className="truncate">{branch.name}</span>
            <span className="ml-auto pl-3 font-mono text-xs text-muted-foreground">
              {branch.code}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ProjectSelect() {
  const user = useCurrentUser();
  const allowed = canUser(user, 'projects.project', 'VIEW');
  const { projectId, setProjectId } = useWorkContext();
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const debounced = useDebouncedValue(search.trim(), 250);
  const projects = useProjects(
    { limit: 30, ...(debounced ? { search: debounced } : {}) },
    allowed && open,
  );
  const selectedOnly = useProjects({ limit: 100 }, allowed && Boolean(projectId));
  if (!allowed) return null;
  const items = projects.data?.items ?? [];
  const selected = [...items, ...(selectedOnly.data?.items ?? [])].find((p) => p.id === projectId);
  const label = projectId ? (selected?.name ?? 'Project') : 'All projects';
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          size="md"
          variant="secondary"
          aria-label={`Project: ${label}`}
          className={cn('max-w-56', projectId && 'border-primary-border bg-primary-subtle')}
        >
          <FolderKanban className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
          <span className="hidden truncate sm:inline">{label}</span>
          <ChevronDown className="size-3 shrink-0 text-muted-foreground" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-2">
        <SearchInput
          value={search}
          onValueChange={setSearch}
          placeholder="Find a project"
          wrapperClassName="sm:w-full"
          autoFocus
        />
        <ul className="scroll-thin mt-2 max-h-72 overflow-y-auto" aria-label="Projects">
          <li>
            <button
              type="button"
              onClick={() => {
                setProjectId(null);
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-surface-muted"
            >
              <Check className={projectId === null ? 'size-3.5' : 'size-3.5 opacity-0'} aria-hidden />
              All projects
            </button>
          </li>
          {projects.isPending ? (
            <li className="px-2 py-2 text-sm text-muted-foreground">Loading projects…</li>
          ) : items.length === 0 ? (
            <li className="px-2 py-2 text-sm text-muted-foreground">No projects match.</li>
          ) : (
            items.map((project) => (
              <li key={project.id}>
                <button
                  type="button"
                  onClick={() => {
                    setProjectId(project.id);
                    setOpen(false);
                  }}
                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-surface-muted"
                >
                  <Check className={projectId === project.id ? 'size-3.5' : 'size-3.5 opacity-0'} aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{project.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {project.code} · {project.customer.name}
                    </span>
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

export function ContextBar() {
  return (
    <div className="flex items-center gap-2">
      <CompanyLabel />
      <BranchSelect />
      <ProjectSelect />
    </div>
  );
}
