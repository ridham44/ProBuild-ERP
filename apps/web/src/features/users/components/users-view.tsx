'use client';

import type { DataColumn } from '@/components/common/data-table/column-meta';
import { MoreHorizontal, Plus, Users } from 'lucide-react';
import * as React from 'react';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { DataTable } from '@/components/common/data-table/data-table';
import { EmptyState } from '@/components/common/empty-state';
import { PageHeader } from '@/components/common/page-header';
import { SearchInput } from '@/components/common/search-input';
import { StatusBadge } from '@/components/common/status-badge';
import { Badge } from '@/components/ui/badge';
import { Button, IconButton } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from '@/components/ui/toast';
import { useCan, useCurrentUser } from '@/features/auth/components/current-user';
import { PermissionGate } from '@/features/auth/components/permission-gate';
import { canUser } from '@/features/auth/permissions';
import type { UserDto } from '@/lib/api/types';
import { errorMessage } from '@/lib/api/errors';
import { formatRelative } from '@/lib/format';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { useIssuePasswordReset, useSetUserActive, useUsers } from '../api/hooks';
import { ResetLinkDialog, type ResetLink } from './reset-link-dialog';
import { UserDialog } from './user-dialog';
import { UserRolesDrawer } from './user-roles-drawer';

const USER_TYPE_LABEL: Record<UserDto['userType'], string> = {
  INTERNAL: 'Staff',
  CLIENT: 'Client',
  SUPPLIER: 'Supplier',
  SUBCONTRACTOR: 'Subcontractor',
  EMPLOYEE: 'Employee',
};

function RoleBadges({ user }: { user: UserDto }) {
  if (user.isSuperAdmin) return <Badge tone="primary">Super admin</Badge>;
  const names = [...new Set(user.userRoleAssignments.map((assignment) => assignment.role.name))];
  if (names.length === 0) return <span className="text-muted-foreground">No roles</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {names.slice(0, 2).map((name) => (
        <Badge key={name}>{name}</Badge>
      ))}
      {names.length > 2 ? <Badge>+{names.length - 2}</Badge> : null}
    </div>
  );
}

export function UsersView() {
  const me = useCurrentUser();
  const canCreate = useCan('security.user', 'CREATE');
  const canEdit = useCan('security.user', 'EDIT');
  const canListRoles = canUser(me, 'security.role', 'VIEW');
  const canListBranches = canUser(me, 'organization.branch', 'VIEW');

  const [search, setSearch] = React.useState('');
  const debounced = useDebouncedValue(search.trim(), 300);
  const users = useUsers(debounced);
  const setActive = useSetUserActive();
  const issueReset = useIssuePasswordReset();

  const [createOpen, setCreateOpen] = React.useState(false);
  const [rolesUserId, setRolesUserId] = React.useState<string | null>(null);
  const [toggleTarget, setToggleTarget] = React.useState<UserDto | null>(null);
  const [resetTarget, setResetTarget] = React.useState<UserDto | null>(null);
  const [resetLink, setResetLink] = React.useState<ResetLink | null>(null);

  const rolesUser = users.data?.find((user) => user.id === rolesUserId) ?? null;

  function confirmToggle(): void {
    if (!toggleTarget) return;
    const next = !toggleTarget.active;
    setActive.mutate(
      { id: toggleTarget.id, active: next },
      {
        onSuccess: () => {
          toast.success(
            next ? 'User reactivated' : 'User deactivated',
            next ? undefined : 'Their sessions were signed out.',
          );
          setToggleTarget(null);
        },
        onError: (error) => {
          toast.error('Could not update the user', errorMessage(error));
          setToggleTarget(null);
        },
      },
    );
  }

  function confirmReset(): void {
    if (!resetTarget) return;
    const target = resetTarget;
    issueReset.mutate(target.id, {
      onSuccess: (result) => {
        setResetTarget(null);
        setResetLink({ userName: target.name, token: result.token, expiresAt: result.expiresAt });
      },
      onError: (error) => {
        toast.error('Could not issue a reset link', errorMessage(error));
        setResetTarget(null);
      },
    });
  }

  const columns = React.useMemo<DataColumn<UserDto>[]>(
    () => [
      {
        id: 'name',
        header: 'User',
        enableSorting: true,
        accessorFn: (user) => user.name,
        meta: { sticky: true },
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="font-medium">{row.original.name}</p>
            <p className="text-xs text-muted-foreground">{row.original.email}</p>
          </div>
        ),
      },
      {
        id: 'type',
        header: 'Type',
        cell: ({ row }) => USER_TYPE_LABEL[row.original.userType],
        meta: { hideBelow: 'lg' },
      },
      {
        id: 'roles',
        header: 'Roles',
        cell: ({ row }) => <RoleBadges user={row.original} />,
        meta: { hideBelow: 'sm' },
      },
      {
        id: 'status',
        header: 'Status',
        cell: ({ row }) => <StatusBadge status={row.original.active ? 'ACTIVE' : 'INACTIVE'} />,
      },
      {
        id: 'lastLogin',
        header: 'Last sign-in',
        accessorFn: (user) => user.lastLoginAt ?? '',
        enableSorting: true,
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {row.original.lastLoginAt ? formatRelative(row.original.lastLoginAt) : 'Never'}
          </span>
        ),
        meta: { hideBelow: 'md' },
      },
      {
        id: 'actions',
        header: () => <span className="sr-only">Actions</span>,
        enableHiding: false,
        meta: { numeric: true },
        cell: ({ row }) => {
          const user = row.original;
          const isSelf = user.id === me.id;
          return (
            <div className="flex justify-end gap-1.5">
              <Button size="sm" onClick={() => setRolesUserId(user.id)}>
                Roles
              </Button>
              {canEdit ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <IconButton label={`More actions for ${user.name}`} size="sm">
                      <MoreHorizontal className="size-4" aria-hidden />
                    </IconButton>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onSelect={() => setResetTarget(user)}>
                      Issue password reset
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      destructive={user.active}
                      disabled={isSelf && user.active}
                      onSelect={() => setToggleTarget(user)}
                    >
                      {user.active ? 'Deactivate user' : 'Reactivate user'}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : null}
            </div>
          );
        },
      },
    ],
    [canEdit, me.id],
  );

  return (
    <PermissionGate module="security.user">
      <PageHeader
        title="Users"
        description="People who can sign in to ProBuild and the roles that decide what they can see and do."
        breadcrumbs={[{ label: 'Administration' }, { label: 'Users' }]}
        actions={
          canCreate ? (
            <Button variant="primary" onClick={() => setCreateOpen(true)}>
              <Plus className="size-3.5" aria-hidden />
              New user
            </Button>
          ) : null
        }
      />
      <DataTable
        caption="Users"
        columns={columns}
        data={users.data ?? []}
        getRowId={(user) => user.id}
        loading={users.isPending}
        error={users.error}
        onRetry={() => void users.refetch()}
        toolbar={
          <SearchInput
            value={search}
            onValueChange={setSearch}
            placeholder="Search by name or email"
          />
        }
        emptyState={
          <EmptyState
            icon={Users}
            title={debounced ? 'No users match that search' : 'No users yet'}
            description={
              debounced
                ? 'Check the spelling or clear the search.'
                : 'Add the first person, give them a temporary password and assign a role so they can start work.'
            }
            action={
              canCreate && !debounced ? (
                <Button variant="primary" onClick={() => setCreateOpen(true)}>
                  <Plus className="size-3.5" aria-hidden />
                  New user
                </Button>
              ) : undefined
            }
          />
        }
      />
      {users.data && users.data.length >= 100 ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Showing the first 100 users. Use search to find others.
        </p>
      ) : null}

      <UserDialog open={createOpen} onOpenChange={setCreateOpen} canListRoles={canListRoles} />
      <UserRolesDrawer
        user={rolesUser}
        onClose={() => setRolesUserId(null)}
        canEdit={canEdit}
        canListRoles={canListRoles}
        canListBranches={canListBranches}
      />
      <ConfirmDialog
        open={toggleTarget !== null}
        onOpenChange={(open) => (open ? undefined : setToggleTarget(null))}
        title={
          toggleTarget?.active
            ? `Deactivate ${toggleTarget.name}?`
            : `Reactivate ${toggleTarget?.name ?? ''}?`
        }
        description={
          toggleTarget?.active
            ? 'They are signed out immediately and cannot sign in until reactivated. Their records and history are kept.'
            : 'They can sign in again with their existing password.'
        }
        confirmLabel={toggleTarget?.active ? 'Deactivate' : 'Reactivate'}
        tone={toggleTarget?.active ? 'danger' : 'primary'}
        loading={setActive.isPending}
        onConfirm={confirmToggle}
      />
      <ConfirmDialog
        open={resetTarget !== null}
        onOpenChange={(open) => (open ? undefined : setResetTarget(null))}
        title={`Issue a password reset for ${resetTarget?.name ?? ''}?`}
        description="This creates a one-time link valid for one hour and invalidates any earlier reset link for this user. You will see the link once."
        confirmLabel="Issue reset link"
        loading={issueReset.isPending}
        onConfirm={confirmReset}
      />
      <ResetLinkDialog link={resetLink} onClose={() => setResetLink(null)} />
    </PermissionGate>
  );
}
