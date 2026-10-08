'use client';

import { Trash2 } from 'lucide-react';
import * as React from 'react';
import { FormField } from '@/components/common/form-field';
import { Alert } from '@/components/ui/alert';
import { Button, IconButton } from '@/components/ui/button';
import { Drawer, DrawerContent } from '@/components/ui/drawer';
import { Select } from '@/components/ui/select';
import { toast } from '@/components/ui/toast';
import { useBranches } from '@/features/branches/api/hooks';
import { useRoles } from '@/features/roles/api/hooks';
import type { RoleAssignmentDto, UserDto } from '@/lib/api/types';
import { errorMessage } from '@/lib/api/errors';
import { useAssignRole, useRemoveAssignment } from '../api/hooks';

const COMPANY_WIDE = 'company';

function describeScope(assignment: RoleAssignmentDto, branchNames: Map<string, string>): string {
  const parts: string[] = [];
  if (assignment.branchId)
    parts.push(`Branch: ${branchNames.get(assignment.branchId) ?? 'unknown branch'}`);
  if (assignment.projectId) parts.push('Single project');
  if (assignment.warehouseId) parts.push('Single warehouse');
  return parts.length > 0 ? parts.join(' · ') : 'Company-wide';
}

type Props = {
  user: UserDto | null;
  onClose: () => void;
  canEdit: boolean;
  canListRoles: boolean;
  canListBranches: boolean;
};

export function UserRolesDrawer({ user, onClose, canEdit, canListRoles, canListBranches }: Props) {
  const roles = useRoles(canListRoles && user !== null);
  const branches = useBranches({ limit: 100 }, canListBranches && user !== null);
  const assign = useAssignRole();
  const remove = useRemoveAssignment();
  const [roleId, setRoleId] = React.useState('');
  const [scope, setScope] = React.useState(COMPANY_WIDE);
  const [error, setError] = React.useState<string | null>(null);

  const branchNames = new Map(
    (branches.data?.items ?? []).map((branch) => [branch.id, branch.name]),
  );

  function submit(event: React.FormEvent): void {
    event.preventDefault();
    if (!user || !roleId || assign.isPending) return;
    setError(null);
    assign.mutate(
      {
        userId: user.id,
        body: {
          roleId,
          companyId: null,
          branchId: scope === COMPANY_WIDE ? null : scope,
          projectId: null,
          warehouseId: null,
        },
      },
      {
        onSuccess: () => {
          toast.success('Role assigned');
          setRoleId('');
          setScope(COMPANY_WIDE);
        },
        onError: (cause) => setError(errorMessage(cause)),
      },
    );
  }

  function removeAssignment(assignmentId: string): void {
    if (!user) return;
    setError(null);
    remove.mutate(
      { userId: user.id, assignmentId },
      {
        onSuccess: () => toast.success('Role removed'),
        onError: (cause) => setError(errorMessage(cause)),
      },
    );
  }

  return (
    <Drawer open={user !== null} onOpenChange={(open) => (open ? undefined : onClose())}>
      <DrawerContent title={user ? `Roles for ${user.name}` : 'Roles'} description={user?.email}>
        <div className="scroll-thin flex-1 space-y-5 overflow-y-auto p-4">
          {error ? <Alert tone="danger">{error}</Alert> : null}
          <section aria-label="Current roles">
            <h3 className="mb-2 text-sm font-medium">Assigned</h3>
            {user && user.userRoleAssignments.length > 0 ? (
              <ul className="divide-y divide-border rounded border border-border">
                {user.userRoleAssignments.map((assignment) => (
                  <li key={assignment.id} className="flex items-center gap-2 px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{assignment.role.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {describeScope(assignment, branchNames)}
                      </p>
                    </div>
                    {canEdit ? (
                      <IconButton
                        label={`Remove ${assignment.role.name}`}
                        size="sm"
                        disabled={remove.isPending}
                        onClick={() => removeAssignment(assignment.id)}
                      >
                        <Trash2 className="size-3.5" aria-hidden />
                      </IconButton>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded border border-dashed border-border-strong px-3 py-4 text-sm text-muted-foreground">
                {user?.isSuperAdmin
                  ? 'Super administrators have every permission without role assignments.'
                  : 'No roles yet. This user can sign in but sees nothing until a role is assigned.'}
              </p>
            )}
          </section>

          {canEdit ? (
            <form onSubmit={submit} className="space-y-3 border-t border-border pt-4">
              <h3 className="text-sm font-medium">Assign a role</h3>
              {canListRoles ? (
                <>
                  <FormField label="Role">
                    {(control) => (
                      <Select
                        {...control}
                        value={roleId}
                        onChange={(event) => setRoleId(event.target.value)}
                      >
                        <option value="">Choose a role</option>
                        {(roles.data ?? []).map((role) => (
                          <option key={role.id} value={role.id}>
                            {role.name}
                          </option>
                        ))}
                      </Select>
                    )}
                  </FormField>
                  <FormField
                    label="Applies to"
                    hint="A branch-scoped role only covers that branch. Project and warehouse scopes arrive with those modules."
                  >
                    {(control) => (
                      <Select
                        {...control}
                        value={scope}
                        onChange={(event) => setScope(event.target.value)}
                      >
                        <option value={COMPANY_WIDE}>Whole company</option>
                        {(branches.data?.items ?? [])
                          .filter((branch) => branch.active)
                          .map((branch) => (
                            <option key={branch.id} value={branch.id}>
                              Branch: {branch.name}
                            </option>
                          ))}
                      </Select>
                    )}
                  </FormField>
                  <Button
                    type="submit"
                    variant="primary"
                    disabled={!roleId}
                    loading={assign.isPending}
                  >
                    Assign role
                  </Button>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Your role cannot view the role list, so roles cannot be assigned from here.
                </p>
              )}
            </form>
          ) : null}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
