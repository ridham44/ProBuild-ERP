'use client';

import { PERMISSION_ACTIONS, MODULES, type PermissionActionKey } from '@probuild/shared';
import { Check } from 'lucide-react';
import * as React from 'react';
import { titleCase } from '@/lib/format';
import { cn } from '@/lib/utils';

export const permissionKey = (module: string, action: PermissionActionKey): string =>
  `${module}:${action}`;

const DOMAIN_LABELS: Record<string, string> = {
  ai: 'AI',
  hse: 'HSE',
};

function domainLabel(domain: string): string {
  return DOMAIN_LABELS[domain] ?? titleCase(domain);
}

const MODULE_LABELS: Record<string, string> = {
  'projects.wbs': 'WBS',
  'projects.boq': 'BOQ',
  'projects.rfi': 'RFI',
  'projects.costcode': 'Cost codes',
  'procurement.rfq': 'RFQ',
  'inventory.mrp': 'MRP',
  'field.hse': 'HSE',
  'ai.assistant': 'AI assistant',
  'reports.view': 'Reports',
  'audit.log': 'Audit log',
};

function moduleLabel(module: string): string {
  const known = MODULE_LABELS[module];
  if (known) return known;
  const [, ...rest] = module.split('.');
  return titleCase(rest.join(' '));
}

const domains = [...new Set(MODULES.map((module) => module.split('.')[0] ?? module))];

export type PermissionMatrixProps = {
  granted: ReadonlySet<string>;
  editable: boolean;
  /** Whether the signed-in editor may grant this pair; ungrantable cells are locked while editing. */
  canGrant: (module: string, action: PermissionActionKey) => boolean;
  onToggle: (module: string, action: PermissionActionKey, next: boolean) => void;
  onToggleModule: (module: string, next: boolean) => void;
};

function MatrixRow({
  module,
  granted,
  editable,
  canGrant,
  onToggle,
  onToggleModule,
}: PermissionMatrixProps & { module: string }) {
  const grantable = PERMISSION_ACTIONS.filter((action) => canGrant(module, action));
  const allOn =
    grantable.length > 0 && grantable.every((action) => granted.has(permissionKey(module, action)));
  return (
    <tr className="hover:bg-surface-muted/50">
      <th
        scope="row"
        className="sticky left-0 z-[1] min-w-44 border-b border-border bg-surface px-3 py-1.5 text-left text-sm font-normal"
      >
        <span className="flex items-center justify-between gap-2">
          <span>{moduleLabel(module)}</span>
          {editable && grantable.length > 0 ? (
            <button
              type="button"
              onClick={() => onToggleModule(module, !allOn)}
              className="text-2xs text-primary hover:underline"
            >
              {allOn ? 'Clear row' : 'All'}
            </button>
          ) : null}
        </span>
      </th>
      {PERMISSION_ACTIONS.map((action) => {
        const on = granted.has(permissionKey(module, action));
        const allowed = canGrant(module, action);
        return (
          <td key={action} className="border-b border-border px-0 py-1.5 text-center">
            {editable ? (
              <input
                type="checkbox"
                className="size-3.5 cursor-pointer accent-[hsl(var(--primary))] disabled:cursor-not-allowed disabled:opacity-40"
                checked={on}
                disabled={!allowed}
                title={allowed ? undefined : 'You cannot grant a permission you do not hold'}
                aria-label={`${moduleLabel(module)} ${titleCase(action)}`}
                onChange={(event) => onToggle(module, action, event.target.checked)}
              />
            ) : on ? (
              <Check
                className="mx-auto size-3.5 text-approved"
                aria-label={`${moduleLabel(module)} ${titleCase(action)}: granted`}
              />
            ) : (
              <span className="text-border-strong" aria-hidden>
                ·
              </span>
            )}
          </td>
        );
      })}
    </tr>
  );
}

/** Role by module by action grid, grouped by domain, with a sticky header and first column. */
export function PermissionMatrix(props: PermissionMatrixProps) {
  return (
    <div className="scroll-thin max-h-[calc(100vh-20rem)] min-h-64 overflow-auto rounded-lg border border-border bg-surface">
      <table
        className="w-full min-w-max border-separate border-spacing-0 text-sm"
        aria-label="Permission matrix"
      >
        <thead>
          <tr>
            <th
              scope="col"
              className="sticky left-0 top-0 z-20 border-b border-border bg-surface-muted px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground"
            >
              Module
            </th>
            {PERMISSION_ACTIONS.map((action) => (
              <th
                key={action}
                scope="col"
                className={cn(
                  'sticky top-0 z-10 w-14 border-b border-border bg-surface-muted px-1 py-2 text-center text-2xs font-medium uppercase tracking-wide text-muted-foreground',
                )}
              >
                {titleCase(action)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {domains.map((domain) => (
            <React.Fragment key={domain}>
              <tr>
                <th
                  colSpan={PERMISSION_ACTIONS.length + 1}
                  scope="colgroup"
                  className="sticky left-0 border-b border-border bg-surface-muted/70 px-3 py-1 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  {domainLabel(domain)}
                </th>
              </tr>
              {MODULES.filter((module) => module.startsWith(`${domain}.`)).map((module) => (
                <MatrixRow key={module} module={module} {...props} />
              ))}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
