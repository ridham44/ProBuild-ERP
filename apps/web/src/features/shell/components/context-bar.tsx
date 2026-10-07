'use client';

import { Building2, Check, ChevronDown, GitBranch } from 'lucide-react';
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

/** Project context is intentionally absent: it renders once a projects endpoint exists and returns data. */
export function ContextBar() {
  return (
    <div className="flex items-center gap-2">
      <CompanyLabel />
      <BranchSelect />
    </div>
  );
}
