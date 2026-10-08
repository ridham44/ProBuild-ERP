'use client';

import { Plus, Trash2, UsersRound } from 'lucide-react';
import * as React from 'react';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { EmptyState } from '@/components/common/empty-state';
import { QueryErrorState } from '@/components/common/error-state';
import { FormField } from '@/components/common/form-field';
import { Panel } from '@/components/common/panel';
import { Alert } from '@/components/ui/alert';
import { Button, IconButton } from '@/components/ui/button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/toast';
import { useCan } from '@/features/auth/components/current-user';
import { useUsers } from '@/features/users/api/hooks';
import { errorMessage } from '@/lib/api/errors';
import type { ProjectDetail, ProjectMember } from '@/lib/api/types';
import { formatDate } from '@/lib/format';
import { useAddProjectMember, useProjectMembers, useRemoveProjectMember } from '../api/hooks';

const ROLE_SUGGESTIONS = ['Project Manager', 'Project Engineer', 'Site Engineer', 'Quantity Surveyor', 'Foreman', 'Safety Officer'];

function AddMemberDialog({
  open,
  onOpenChange,
  projectId,
  existing,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  existing: string[];
}) {
  const canSeeUsers = useCan('security.user', 'VIEW');
  const users = useUsers('', canSeeUsers && open);
  const add = useAddProjectMember(projectId);
  const [userId, setUserId] = React.useState('');
  const [role, setRole] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (open) {
      setUserId('');
      setRole('');
      setError(null);
    }
  }, [open]);
  const candidates = (users.data ?? []).filter((user) => user.active && !existing.includes(user.id));

  function submit(event: React.FormEvent): void {
    event.preventDefault();
    setError(null);
    add.mutate(
      { userId, role: role.trim() },
      {
        onSuccess: () => {
          toast.success('Team member added');
          onOpenChange(false);
        },
        onError: (cause) => setError(errorMessage(cause)),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (add.isPending ? undefined : onOpenChange(next))}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Add team member</DialogTitle>
          <DialogDescription>Team members see the project in their lists and can be assigned work.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          <DialogBody className="space-y-3">
            {error ? <Alert tone="danger">{error}</Alert> : null}
            {canSeeUsers ? (
              <FormField label="Person" required>
                {(control) => (
                  <Select {...control} value={userId} onChange={(event) => setUserId(event.target.value)}>
                    <option value="">Select a user</option>
                    {candidates.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name}
                      </option>
                    ))}
                  </Select>
                )}
              </FormField>
            ) : (
              <Alert tone="warning">Your role cannot list users, so people cannot be added from here.</Alert>
            )}
            <FormField label="Role on this project" required>
              {(control) => (
                <>
                  <Input {...control} list="project-roles" value={role} onChange={(event) => setRole(event.target.value)} />
                  <datalist id="project-roles">
                    {ROLE_SUGGESTIONS.map((suggestion) => (
                      <option key={suggestion} value={suggestion} />
                    ))}
                  </datalist>
                </>
              )}
            </FormField>
          </DialogBody>
          <DialogFooter>
            <Button onClick={() => onOpenChange(false)} disabled={add.isPending}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={add.isPending} disabled={!userId || role.trim().length === 0}>
              Add member
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ProjectTeam({ project, canEdit }: { project: ProjectDetail; canEdit: boolean }) {
  const members = useProjectMembers(project.id);
  const remove = useRemoveProjectMember(project.id);
  const [open, setOpen] = React.useState(false);
  const [removing, setRemoving] = React.useState<ProjectMember | null>(null);
  const items = members.data ?? [];
  return (
    <Panel
      title="Project team"
      bodyClassName="p-0"
      actions={
        canEdit ? (
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus className="size-3.5" aria-hidden />
            Add member
          </Button>
        ) : null
      }
    >
      {members.isPending ? (
        <div className="p-4">
          <Skeleton className="h-16" />
        </div>
      ) : members.isError ? (
        <QueryErrorState error={members.error} onRetry={() => void members.refetch()} compact />
      ) : items.length === 0 ? (
        <EmptyState
          compact
          icon={UsersRound}
          title="No team members yet"
          description="Add the engineers, QS and foremen working on this project."
          action={
            canEdit ? (
              <Button variant="primary" onClick={() => setOpen(true)}>
                <Plus className="size-3.5" aria-hidden />
                Add member
              </Button>
            ) : undefined
          }
        />
      ) : (
        <ul className="divide-y divide-border">
          {items.map((member) => (
            <li key={member.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
              <span className="flex size-7 shrink-0 items-center justify-center rounded bg-surface-muted text-2xs font-semibold text-muted-foreground">
                {member.user.name
                  .split(/\s+/)
                  .slice(0, 2)
                  .map((part) => part.charAt(0).toUpperCase())
                  .join('')}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-medium">{member.user.name}</p>
                <p className="truncate text-xs text-muted-foreground">{member.user.email}</p>
              </div>
              <span className="text-muted-foreground">{member.role}</span>
              <span className="hidden text-xs text-muted-foreground sm:inline">Since {formatDate(member.createdAt)}</span>
              {canEdit ? (
                <IconButton label={`Remove ${member.user.name}`} size="sm" onClick={() => setRemoving(member)}>
                  <Trash2 className="size-3.5" aria-hidden />
                </IconButton>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      <AddMemberDialog open={open} onOpenChange={setOpen} projectId={project.id} existing={items.map((member) => member.userId)} />
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(next) => (next ? undefined : setRemoving(null))}
        title={`Remove ${removing?.user.name ?? 'member'}?`}
        description="They lose project-scoped access granted through this team."
        confirmLabel="Remove"
        tone="danger"
        loading={remove.isPending}
        onConfirm={() =>
          removing &&
          remove.mutate(removing.id, {
            onSuccess: () => {
              toast.success('Team member removed');
              setRemoving(null);
            },
            onError: (error) => toast.error('Could not remove the member', errorMessage(error)),
          })
        }
      />
    </Panel>
  );
}
