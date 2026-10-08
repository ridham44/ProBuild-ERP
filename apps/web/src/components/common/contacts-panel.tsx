'use client';

import { createContactSchema, type CreateContactInput } from '@probuild/shared';
import { Mail, Pencil, Phone, Plus, Trash2, UserRound } from 'lucide-react';
import * as React from 'react';
import { Controller, useForm } from 'react-hook-form';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { EmptyState } from '@/components/common/empty-state';
import { TextField } from '@/components/common/form-controls';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { Button, IconButton } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/toast';
import { errorMessage } from '@/lib/api/errors';
import type { Contact } from '@/lib/api/types';
import { applyServerErrors, formResolver, withClearedFields } from '@/lib/forms';

type FormValues = CreateContactInput;
const FIELDS = ['name', 'position', 'email', 'phone', 'isPrimary'] as const;

function ContactDialog({
  open,
  onOpenChange,
  contact,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact: Contact | null;
  onSave: (contactId: string | undefined, body: Partial<CreateContactInput>) => Promise<void>;
}) {
  const [pending, setPending] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const initial: FormValues = {
    name: contact?.name ?? '',
    position: contact?.position ?? '',
    email: contact?.email ?? '',
    phone: contact?.phone ?? '',
    isPrimary: contact?.isPrimary ?? false,
  };
  const {
    register,
    control,
    handleSubmit,
    setError,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: formResolver<FormValues>(createContactSchema),
    defaultValues: initial,
  });
  React.useEffect(() => {
    if (open) {
      reset(initial);
      setFormError(null);
    }
    // `initial` is derived from `contact`; resetting on open/contact change is the intent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, contact, reset]);

  async function submit(values: FormValues): Promise<void> {
    setPending(true);
    setFormError(null);
    try {
      const body = contact ? withClearedFields(initial, values, ['position', 'email', 'phone']) : values;
      await onSave(contact?.id, body);
      toast.success(contact ? 'Contact updated' : 'Contact added');
      onOpenChange(false);
    } catch (error) {
      setFormError(applyServerErrors(error, setError, FIELDS));
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (pending ? undefined : onOpenChange(next))}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>{contact ? `Edit ${contact.name}` : 'Add contact'}</DialogTitle>
          <DialogDescription>
            The primary contact is the person documents are addressed to.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(submit)} noValidate className="flex min-h-0 flex-1 flex-col">
          <DialogBody className="space-y-3">
            {formError ? <Alert tone="danger">{formError}</Alert> : null}
            <div className="grid gap-3 sm:grid-cols-2">
              <TextField label="Name" required autoFocus error={errors.name?.message} {...register('name')} />
              <TextField label="Position" error={errors.position?.message} {...register('position')} />
              <TextField label="Email" type="email" error={errors.email?.message} {...register('email')} />
              <TextField label="Phone" type="tel" error={errors.phone?.message} {...register('phone')} />
            </div>
            <div className="flex items-center gap-2">
              <Controller
                control={control}
                name="isPrimary"
                render={({ field }) => (
                  <Checkbox
                    id="contact-primary"
                    checked={field.value === true}
                    onCheckedChange={(checked) => field.onChange(checked === true)}
                  />
                )}
              />
              <Label htmlFor="contact-primary">Primary contact</Label>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button onClick={() => onOpenChange(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={pending}>
              {contact ? 'Save changes' : 'Add contact'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** People at a supplier or customer. The owner supplies the save/delete calls. */
export function ContactsPanel({
  contacts,
  canEdit,
  onSave,
  onDelete,
}: {
  contacts: Contact[];
  canEdit: boolean;
  onSave: (contactId: string | undefined, body: Partial<CreateContactInput>) => Promise<void>;
  onDelete: (contactId: string) => Promise<void>;
}) {
  const [editing, setEditing] = React.useState<Contact | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [removing, setRemoving] = React.useState<Contact | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  function open(contact: Contact | null): void {
    setEditing(contact);
    setDialogOpen(true);
  }

  async function confirmDelete(): Promise<void> {
    if (!removing) return;
    setDeleting(true);
    try {
      await onDelete(removing.id);
      toast.success('Contact removed');
      setRemoving(null);
    } catch (error) {
      toast.error('Could not remove the contact', errorMessage(error));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-3">
      {canEdit ? (
        <div className="flex justify-end">
          <Button onClick={() => open(null)}>
            <Plus className="size-3.5" aria-hidden />
            Add contact
          </Button>
        </div>
      ) : null}
      {contacts.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface">
          <EmptyState
            compact
            icon={UserRound}
            title="No contacts recorded"
            description="Add the people you deal with so buyers know who to call about quotes, deliveries and invoices."
            action={
              canEdit ? (
                <Button variant="primary" onClick={() => open(null)}>
                  <Plus className="size-3.5" aria-hidden />
                  Add contact
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
          {contacts.map((contact) => (
            <li key={contact.id} className="flex items-start gap-3 px-4 py-3">
              <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded bg-surface-muted text-xs font-semibold text-muted-foreground">
                {contact.name
                  .split(/\s+/)
                  .slice(0, 2)
                  .map((part) => part.charAt(0).toUpperCase())
                  .join('')}
              </span>
              <div className="min-w-0 flex-1 text-sm">
                <p className="flex items-center gap-2 font-medium">
                  {contact.name}
                  {contact.isPrimary ? <Badge tone="primary">Primary</Badge> : null}
                </p>
                {contact.position ? (
                  <p className="text-xs text-muted-foreground">{contact.position}</p>
                ) : null}
                <p className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-muted-foreground">
                  {contact.email ? (
                    <a href={`mailto:${contact.email}`} className="inline-flex items-center gap-1 hover:text-foreground">
                      <Mail className="size-3" aria-hidden />
                      {contact.email}
                    </a>
                  ) : null}
                  {contact.phone ? (
                    <a href={`tel:${contact.phone}`} className="inline-flex items-center gap-1 hover:text-foreground">
                      <Phone className="size-3" aria-hidden />
                      {contact.phone}
                    </a>
                  ) : null}
                </p>
              </div>
              {canEdit ? (
                <div className="flex shrink-0 gap-1">
                  <IconButton label={`Edit ${contact.name}`} size="sm" onClick={() => open(contact)}>
                    <Pencil className="size-3.5" aria-hidden />
                  </IconButton>
                  <IconButton label={`Remove ${contact.name}`} size="sm" onClick={() => setRemoving(contact)}>
                    <Trash2 className="size-3.5" aria-hidden />
                  </IconButton>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      <ContactDialog open={dialogOpen} onOpenChange={setDialogOpen} contact={editing} onSave={onSave} />
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(next) => (next ? undefined : setRemoving(null))}
        title={`Remove ${removing?.name ?? 'contact'}?`}
        description="The contact is removed from this record. Past documents are not affected."
        confirmLabel="Remove"
        tone="danger"
        loading={deleting}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
}
