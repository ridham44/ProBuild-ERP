'use client';

import { setAccreditationSchema } from '@probuild/shared';
import { Ban, Pencil, RotateCcw, ShieldCheck } from 'lucide-react';
import * as React from 'react';
import { Controller, useForm } from 'react-hook-form';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { TextAreaField, TextField } from '@/components/common/form-controls';
import { ActivityPanel } from '@/components/common/activity-panel';
import { ContactsPanel } from '@/components/common/contacts-panel';
import { QueryErrorState } from '@/components/common/error-state';
import { DetailPageSkeleton } from '@/components/common/page-skeleton';
import { PageHeader } from '@/components/common/page-header';
import { DetailList, Panel } from '@/components/common/panel';
import { StatusBadge } from '@/components/common/status-badge';
import { UrlTabs } from '@/components/common/url-tabs';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
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
import { Switch } from '@/components/ui/switch';
import { toast } from '@/components/ui/toast';
import { useCan } from '@/features/auth/components/current-user';
import { PermissionGate } from '@/features/auth/components/permission-gate';
import { errorMessage } from '@/lib/api/errors';
import type { SupplierDetail } from '@/lib/api/types';
import { applyServerErrors, formResolver } from '@/lib/forms';
import { formatDate } from '@/lib/format';
import {
  useDeleteSupplierContact,
  useSaveSupplierContact,
  useSetAccreditation,
  useSupplier,
  useSupplierActivity,
  useUpdateSupplier,
} from '../api/hooks';
import { AccreditationBadge } from './suppliers-view';
import { SupplierHistory } from './supplier-history';
import { SupplierPerformancePanel } from './supplier-performance';
import { SupplierDrawer } from './supplier-form';
import { VAT_OPTIONS } from '@/features/company/schemas';

type AccreditationValues = {
  accredited: boolean;
  accreditationNo?: string;
  accreditationExpiry?: string;
  notes?: string;
};

function AccreditationDialog({
  open,
  onOpenChange,
  supplier,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplier: SupplierDetail;
}) {
  const save = useSetAccreditation(supplier.id);
  const [formError, setFormError] = React.useState<string | null>(null);
  const initial: AccreditationValues = {
    accredited: supplier.accredited,
    accreditationNo: supplier.accreditationNo ?? '',
    accreditationExpiry: supplier.accreditationExpiry?.slice(0, 10) ?? '',
    notes: '',
  };
  const {
    register,
    control,
    handleSubmit,
    setError,
    reset,
    watch,
    formState: { errors },
  } = useForm<AccreditationValues>({
    resolver: formResolver<AccreditationValues>(setAccreditationSchema),
    defaultValues: initial,
  });
  React.useEffect(() => {
    if (open) {
      reset(initial);
      setFormError(null);
    }
    // Reset when reopened or when the saved supplier changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, supplier, reset]);
  const accredited = watch('accredited');

  function submit(values: AccreditationValues): void {
    setFormError(null);
    save.mutate(values, {
      onSuccess: () => {
        toast.success(values.accredited ? 'Accreditation recorded' : 'Accreditation removed');
        onOpenChange(false);
      },
      onError: (error) =>
        setFormError(
          applyServerErrors(error, setError, [
            'accreditationNo',
            'accreditationExpiry',
            'notes',
          ] as const),
        ),
    });
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (save.isPending ? undefined : onOpenChange(next))}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>Accreditation</DialogTitle>
          <DialogDescription>
            Record the supplier&apos;s accreditation certificate so buyers can see whether it is current.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(submit)} noValidate className="flex min-h-0 flex-1 flex-col">
          <DialogBody className="space-y-3">
            {formError ? <Alert tone="danger">{formError}</Alert> : null}
            <div className="flex items-center gap-2">
              <Controller
                control={control}
                name="accredited"
                render={({ field }) => (
                  <Switch id="accredited" checked={field.value} onCheckedChange={field.onChange} />
                )}
              />
              <Label htmlFor="accredited">Accredited supplier</Label>
            </div>
            {accredited ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <TextField
                  label="Accreditation no."
                  required
                  inputClassName="font-mono"
                  error={errors.accreditationNo?.message}
                  {...register('accreditationNo')}
                />
                <TextField
                  label="Valid until"
                  type="date"
                  error={errors.accreditationExpiry?.message}
                  {...register('accreditationExpiry')}
                />
              </div>
            ) : null}
            <TextAreaField label="Note" error={errors.notes?.message} {...register('notes')} />
          </DialogBody>
          <DialogFooter>
            <Button onClick={() => onOpenChange(false)} disabled={save.isPending}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={save.isPending}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Overview({ supplier, canEdit }: { supplier: SupplierDetail; canEdit: boolean }) {
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const vat = VAT_OPTIONS.find((option) => option.value === supplier.vatStatus)?.label;
  const primary = supplier.contacts.find((contact) => contact.isPrimary) ?? supplier.contacts[0];
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="space-y-4">
        <Panel title="Company">
          <DetailList
            columns={2}
            items={[
              { label: 'Registered name', value: supplier.name },
              { label: 'Category', value: supplier.category },
              { label: 'Products supplied', value: supplier.productCategories, wide: true },
              { label: 'Email', value: supplier.email },
              { label: 'Phone', value: supplier.phone },
              { label: 'Address', value: supplier.address, wide: true },
              {
                label: 'Primary contact',
                value: primary ? `${primary.name}${primary.position ? `, ${primary.position}` : ''}` : null,
                wide: true,
              },
            ]}
          />
        </Panel>
        <Panel title="Tax and payment">
          <DetailList
            columns={2}
            items={[
              { label: 'TIN', value: supplier.tin ? <span className="font-mono">{supplier.tin}</span> : null },
              { label: 'VAT status', value: vat },
              {
                label: 'Payment terms',
                value: supplier.paymentTermsDays === 0 ? 'Cash' : `Net ${supplier.paymentTermsDays} days`,
              },
              { label: 'EWT code', value: supplier.ewtCode },
              { label: 'Bank details', value: supplier.bankInfo, wide: true },
            ]}
          />
        </Panel>
        {supplier.notes ? (
          <Panel title="Internal notes">
            <p className="whitespace-pre-wrap text-sm">{supplier.notes}</p>
          </Panel>
        ) : null}
      </div>
      <Panel
        title="Accreditation"
        className="self-start"
        actions={
          canEdit ? (
            <Button size="sm" onClick={() => setDialogOpen(true)}>
              <ShieldCheck className="size-3.5" aria-hidden />
              {supplier.accredited ? 'Update' : 'Record'}
            </Button>
          ) : null
        }
      >
        <div className="space-y-3">
          <AccreditationBadge supplier={supplier} />
          <DetailList
            columns={2}
            items={[
              {
                label: 'Number',
                value: supplier.accreditationNo ? (
                  <span className="font-mono">{supplier.accreditationNo}</span>
                ) : null,
              },
              { label: 'Valid until', value: supplier.accreditationExpiry ? formatDate(supplier.accreditationExpiry) : null },
            ]}
          />
          {!supplier.accredited ? (
            <p className="text-xs text-muted-foreground">
              Not accredited. The supplier can still be invited to an RFQ, but buyers will see the status.
            </p>
          ) : null}
        </div>
      </Panel>
      <AccreditationDialog open={dialogOpen} onOpenChange={setDialogOpen} supplier={supplier} />
    </div>
  );
}

function ContactsTab({ supplier, canEdit }: { supplier: SupplierDetail; canEdit: boolean }) {
  const save = useSaveSupplierContact(supplier.id);
  const remove = useDeleteSupplierContact(supplier.id);
  return (
    <ContactsPanel
      contacts={supplier.contacts}
      canEdit={canEdit}
      onSave={async (contactId, body) => {
        await save.mutateAsync({ ...(contactId ? { contactId } : {}), body });
      }}
      onDelete={async (contactId) => {
        await remove.mutateAsync(contactId);
      }}
    />
  );
}

function ActivityTab({ id }: { id: string }) {
  const activity = useSupplierActivity(id);
  return (
    <Panel>
      <ActivityPanel
        items={activity.data}
        loading={activity.isPending}
        error={activity.error}
        onRetry={() => void activity.refetch()}
      />
    </Panel>
  );
}

export function SupplierDetailView({ id }: { id: string }) {
  const supplier = useSupplier(id);
  const canEdit = useCan('parties.supplier', 'EDIT');
  const update = useUpdateSupplier(id);
  const [editOpen, setEditOpen] = React.useState(false);
  const [toggleOpen, setToggleOpen] = React.useState(false);
  const data = supplier.data;

  function toggleActive(): void {
    if (!data) return;
    update.mutate(
      { active: !data.active },
      {
        onSuccess: () => {
          toast.success(data.active ? 'Supplier deactivated' : 'Supplier reactivated');
          setToggleOpen(false);
        },
        onError: (error) => toast.error('Could not update the supplier', errorMessage(error)),
      },
    );
  }

  return (
    <PermissionGate module="parties.supplier">
      {supplier.isPending ? (
        <DetailPageSkeleton label="Loading supplier" />
      ) : supplier.isError || !data ? (
        <QueryErrorState error={supplier.error} onRetry={() => void supplier.refetch()} />
      ) : (
        <>
          <PageHeader
            title={data.name}
            breadcrumbs={[
              { label: 'Procurement' },
              { label: 'Suppliers', href: '/procurement/suppliers' },
              { label: data.code },
            ]}
            meta={
              <>
                <span className="font-mono text-xs text-muted-foreground">{data.code}</span>
                <StatusBadge status={data.active ? 'ACTIVE' : 'INACTIVE'} />
                <AccreditationBadge supplier={data} />
              </>
            }
            actions={
              canEdit ? (
                <>
                  <Button onClick={() => setToggleOpen(true)}>
                    {data.active ? (
                      <Ban className="size-3.5" aria-hidden />
                    ) : (
                      <RotateCcw className="size-3.5" aria-hidden />
                    )}
                    {data.active ? 'Deactivate' : 'Reactivate'}
                  </Button>
                  <Button variant="primary" onClick={() => setEditOpen(true)}>
                    <Pencil className="size-3.5" aria-hidden />
                    Edit
                  </Button>
                </>
              ) : null
            }
          />
          <UrlTabs
            label="Supplier sections"
            tabs={[
              { id: 'overview', label: 'Overview', content: <Overview supplier={data} canEdit={canEdit} /> },
              {
                id: 'contacts',
                label: 'Contacts',
                count: data.contacts.length,
                content: <ContactsTab supplier={data} canEdit={canEdit} />,
              },
              { id: 'history', label: 'Purchase history', content: <SupplierHistory supplierId={id} /> },
              { id: 'performance', label: 'Performance', content: <SupplierPerformancePanel supplierId={id} canEdit={canEdit} /> },
              { id: 'activity', label: 'Activity', content: <ActivityTab id={id} /> },
            ]}
          />
          <SupplierDrawer open={editOpen} onOpenChange={setEditOpen} supplier={data} />
          <ConfirmDialog
            open={toggleOpen}
            onOpenChange={setToggleOpen}
            title={data.active ? `Deactivate ${data.name}?` : `Reactivate ${data.name}?`}
            description={
              data.active
                ? 'The supplier stays on existing documents but cannot be chosen for new RFQs or orders.'
                : 'The supplier can be chosen for new RFQs and orders again.'
            }
            confirmLabel={data.active ? 'Deactivate' : 'Reactivate'}
            tone={data.active ? 'danger' : 'primary'}
            loading={update.isPending}
            onConfirm={toggleActive}
          />
        </>
      )}
    </PermissionGate>
  );
}
