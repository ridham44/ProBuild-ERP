'use client';

import { PERMISSION_ACTIONS, type PermissionActionKey } from '@probuild/shared';
import { Lock, Plus, ShieldCheck } from 'lucide-react';
import * as React from 'react';
import { EmptyState } from '@/components/common/empty-state';
import { QueryErrorState } from '@/components/common/error-state';
import { PageHeader } from '@/components/common/page-header';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/toast';
import { useCan, useCurrentUser } from '@/features/auth/components/current-user';
import { PermissionGate } from '@/features/auth/components/permission-gate';
import { canUser } from '@/features/auth/permissions';
import type { RoleDto } from '@/lib/api/contract';
import { errorMessage } from '@/lib/api/errors';
import { cn } from '@/lib/utils';
import { useRoles, useSetRolePermissions } from '../api/hooks';
import { CreateRoleDialog } from './create-role-dialog';
import { PermissionMatrix, permissionKey } from './permission-matrix';

const PROTECTED_ROLES = ['Super Admin', 'Company Admin'];

function RoleList({
  roles,
  selectedId,
  onSelect,
}: {
  roles: RoleDto[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <ul
      className="scroll-thin max-h-[calc(100vh-14rem)] divide-y divide-border overflow-y-auto rounded-lg border border-border bg-surface"
      aria-label="Roles"
    >
      {roles.map((role) => (
        <li key={role.id}>
          <button
            type="button"
            onClick={() => onSelect(role.id)}
            aria-current={role.id === selectedId ? 'true' : undefined}
            className={cn(
              'flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-surface-muted/60',
              role.id === selectedId && 'bg-primary-subtle',
            )}
          >
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5">
                <span className="truncate text-sm font-medium">{role.name}</span>
                {role.isSystem ? (
                  <Lock
                    className="size-3 shrink-0 text-subtle-foreground"
                    aria-label="System role"
                  />
                ) : null}
              </span>
              <span className="num text-xs text-muted-foreground">
                {role.permissions.length} permissions · {role._count.userRoleAssignments}{' '}
                {role._count.userRoleAssignments === 1 ? 'assignment' : 'assignments'}
              </span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function RoleDetail({ role }: { role: RoleDto }) {
  const me = useCurrentUser();
  const canEdit = useCan('security.role', 'EDIT');
  const save = useSetRolePermissions();
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState<Set<string>>(
    () => new Set(role.permissions.map((p) => permissionKey(p.module, p.action))),
  );
  const [error, setError] = React.useState<string | null>(null);

  const persisted = React.useMemo(
    () => new Set(role.permissions.map((p) => permissionKey(p.module, p.action))),
    [role.permissions],
  );
  const protectedRole = role.isSystem && PROTECTED_ROLES.includes(role.name) && !me.isSuperAdmin;
  const dirty = draft.size !== persisted.size || [...draft].some((key) => !persisted.has(key));

  function startEditing(): void {
    setDraft(new Set(persisted));
    setError(null);
    setEditing(true);
  }

  function cancelEditing(): void {
    setEditing(false);
    setError(null);
  }

  function toggle(module: string, action: PermissionActionKey, next: boolean): void {
    setDraft((current) => {
      const copy = new Set(current);
      if (next) copy.add(permissionKey(module, action));
      else copy.delete(permissionKey(module, action));
      return copy;
    });
  }

  function toggleModule(module: string, next: boolean): void {
    setDraft((current) => {
      const copy = new Set(current);
      for (const action of PERMISSION_ACTIONS) {
        if (!canUser(me, module, action)) continue;
        if (next) copy.add(permissionKey(module, action));
        else copy.delete(permissionKey(module, action));
      }
      return copy;
    });
  }

  function onSave(): void {
    if (save.isPending) return;
    setError(null);
    const permissions = [...draft].map((key) => {
      const [module = '', action = ''] = key.split(':');
      return { module, action: action as PermissionActionKey };
    });
    save.mutate(
      { id: role.id, permissions },
      {
        onSuccess: () => {
          toast.success(
            `${role.name} permissions saved`,
            'People holding this role get the change at their next request.',
          );
          setEditing(false);
        },
        onError: (cause) => setError(errorMessage(cause)),
      },
    );
  }

  return (
    <div className="min-w-0 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">{role.name}</h2>
          {role.description ? (
            <p className="text-sm text-muted-foreground">{role.description}</p>
          ) : null}
        </div>
        {canEdit && !protectedRole ? (
          editing ? (
            <div className="flex gap-2">
              <Button onClick={cancelEditing} disabled={save.isPending}>
                Cancel
              </Button>
              <Button variant="primary" onClick={onSave} loading={save.isPending} disabled={!dirty}>
                Save permissions
              </Button>
            </div>
          ) : (
            <Button onClick={startEditing}>Edit permissions</Button>
          )
        ) : null}
      </div>
      {protectedRole ? (
        <Alert tone="info">Only a super administrator can change the {role.name} role.</Alert>
      ) : editing ? (
        <Alert tone="info">
          You can only grant permissions you hold yourself. Cells you cannot grant are locked, and
          the server rejects a save that would raise anyone above your own access.
        </Alert>
      ) : null}
      {error ? (
        <Alert tone="danger" title="Permissions were not saved">
          {error}
        </Alert>
      ) : null}
      <PermissionMatrix
        granted={editing ? draft : persisted}
        editable={editing}
        canGrant={(module, action) => canUser(me, module, action)}
        onToggle={toggle}
        onToggleModule={toggleModule}
      />
    </div>
  );
}

export function RolesView() {
  const roles = useRoles();
  const canCreate = useCan('security.role', 'CREATE');
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [createOpen, setCreateOpen] = React.useState(false);
  const selected = roles.data?.find((role) => role.id === selectedId) ?? roles.data?.[0] ?? null;

  return (
    <PermissionGate module="security.role">
      <PageHeader
        title="Roles and permissions"
        description="A role is a set of actions on modules. Users receive roles, optionally limited to a branch."
        breadcrumbs={[{ label: 'Administration' }, { label: 'Roles' }]}
        actions={
          canCreate ? (
            <Button variant="primary" onClick={() => setCreateOpen(true)}>
              <Plus className="size-3.5" aria-hidden />
              New role
            </Button>
          ) : null
        }
      />
      {roles.isPending ? (
        <div
          className="grid gap-4 lg:grid-cols-[18rem_1fr]"
          role="status"
          aria-label="Loading roles"
        >
          <Skeleton className="h-64" />
          <Skeleton className="h-96" />
        </div>
      ) : roles.isError ? (
        <QueryErrorState
          error={roles.error}
          onRetry={() => void roles.refetch()}
          retrying={roles.isFetching}
        />
      ) : roles.data.length === 0 || !selected ? (
        <EmptyState
          icon={ShieldCheck}
          title="No roles defined"
          description="Roles are created with the company. Create one to start granting access."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
          <RoleList roles={roles.data} selectedId={selected.id} onSelect={setSelectedId} />
          <RoleDetail key={selected.id} role={selected} />
        </div>
      )}
      <CreateRoleDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={setSelectedId} />
      {roles.data?.some((role) => role.isSystem) ? (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Lock className="size-3" aria-hidden /> System roles come with the product and cannot be
          renamed or deleted, but their permissions can be adjusted.
        </p>
      ) : null}
    </PermissionGate>
  );
}
