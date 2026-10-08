'use client';

import { X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { EntityCombobox } from '@/components/common/entity-combobox';
import { TextAreaField, TextField } from '@/components/common/form-controls';
import { FormField } from '@/components/common/form-field';
import { PageHeader } from '@/components/common/page-header';
import { DetailList, Panel } from '@/components/common/panel';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button, IconButton } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/toast';
import { PermissionGate } from '@/features/auth/components/permission-gate';
import { useRequisition } from '@/features/requisitions/api/hooks';
import { prStatusKey } from '@/features/requisitions/model';
import { searchSupplierOptions } from '@/features/suppliers/api/hooks';
import { api } from '@/lib/api/browser';
import { apiQuery, errorMessage, saveErrorMessage, unwrapAs } from '@/lib/api/errors';
import type { Page, RequisitionRow, RfqDetail } from '@/lib/api/types';
import { formatDate, formatQty, manilaToday } from '@/lib/format';
import { useCreateRfq, useUpdateRfq, type RfqInput } from '../api/hooks';
import { StatusBadge } from '@/components/common/status-badge';

async function searchOpenRequisitions(search: string) {
  const results = await Promise.all(
    (['APPROVED', 'PARTIALLY_ORDERED'] as const).map(async (status) =>
      unwrapAs<Page<RequisitionRow>>(
        await api.GET('/v1/requisitions', {
          params: { query: apiQuery({ limit: 20, status, ...(search ? { search } : {}) }) },
        }),
      ),
    ),
  );
  return results
    .flatMap((page) => page.items)
    .map((pr) => ({
      value: pr.id,
      label: `${pr.number} · ${pr.project.name}`,
      description: pr.purpose ?? undefined,
    }));
}

type SupplierChip = { id: string; name: string };
type LineChoice = { requisitionLineId: string; selected: boolean; qty: string };

export function RfqForm({ rfq }: { rfq: RfqDetail | null }) {
  const router = useRouter();
  const [requisitionId, setRequisitionId] = React.useState(rfq?.requisitionId ?? '');
  React.useEffect(() => {
    if (!rfq && typeof window !== 'undefined') {
      const preset = new URLSearchParams(window.location.search).get('requisitionId');
      if (preset) setRequisitionId(preset);
    }
  }, [rfq]);
  const requisition = useRequisition(requisitionId, Boolean(requisitionId));
  const create = useCreateRfq();
  const update = useUpdateRfq(rfq?.id ?? '');
  const pending = create.isPending || update.isPending;

  const [choices, setChoices] = React.useState<LineChoice[]>([]);
  const [suppliers, setSuppliers] = React.useState<SupplierChip[]>(
    rfq?.suppliers.map((entry) => ({ id: entry.supplierId, name: entry.supplier.name })) ?? [],
  );
  const [dueDate, setDueDate] = React.useState(rfq?.dueDate?.slice(0, 10) ?? '');
  const [requiredDate, setRequiredDate] = React.useState(rfq?.requiredDate?.slice(0, 10) ?? '');
  const [deliveryLocation, setDeliveryLocation] = React.useState(rfq?.deliveryLocation ?? '');
  const [deliveryRequirements, setDeliveryRequirements] = React.useState(rfq?.deliveryRequirements ?? '');
  const [remarks, setRemarks] = React.useState(rfq?.remarks ?? '');
  const [showErrors, setShowErrors] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(null);

  const pr = requisition.data;
  React.useEffect(() => {
    if (!pr) return;
    setChoices(
      pr.lines.map((line) => {
        const existing = rfq?.lines.find((entry) => entry.requisitionLineId === line.id);
        return {
          requisitionLineId: line.id,
          selected: rfq ? Boolean(existing) : Number(line.remainingQty) > 0,
          qty: existing ? existing.qty : line.remainingQty,
        };
      }),
    );
  }, [pr, rfq]);

  const selected = choices.filter((choice) => choice.selected);
  const errors = {
    requisition: !requisitionId ? 'Choose an approved requisition' : undefined,
    lines: selected.length === 0 ? 'Select at least one line' : undefined,
    suppliers: suppliers.length === 0 ? 'Invite at least one supplier' : undefined,
    dueDate: !dueDate ? 'Set the date quotations are due' : dueDate < manilaToday() && !rfq ? 'Cannot be in the past' : undefined,
  };
  const qtyErrors = Object.fromEntries(
    selected.flatMap((choice) => {
      const line = pr?.lines.find((entry) => entry.id === choice.requisitionLineId);
      const problem =
        !/^\d+(\.\d{1,4})?$/.test(choice.qty) || Number(choice.qty) <= 0
          ? 'Above 0'
          : line && Number(choice.qty) > Number(line.remainingQty) + (rfq ? Number(rfq.lines.find((l) => l.requisitionLineId === line.id)?.qty ?? 0) : 0)
            ? `At most ${line.remainingQty}`
            : null;
      return problem ? [[choice.requisitionLineId, problem]] : [];
    }),
  );
  const valid = !errors.requisition && !errors.lines && !errors.suppliers && !errors.dueDate && Object.keys(qtyErrors).length === 0;

  function patchChoice(id: string, patch: Partial<LineChoice>): void {
    setChoices((current) => current.map((choice) => (choice.requisitionLineId === id ? { ...choice, ...patch } : choice)));
  }

  function submit(event: React.FormEvent): void {
    event.preventDefault();
    if (pending) return;
    setShowErrors(true);
    setServerError(null);
    if (!valid) return;
    const common = {
      supplierIds: suppliers.map((supplier) => supplier.id),
      lines: selected.map((choice) => ({ requisitionLineId: choice.requisitionLineId, qty: choice.qty })),
      dueDate,
      ...(requiredDate ? { requiredDate } : {}),
      ...(deliveryLocation.trim() ? { deliveryLocation: deliveryLocation.trim() } : {}),
      ...(deliveryRequirements.trim() ? { deliveryRequirements: deliveryRequirements.trim() } : {}),
      ...(remarks.trim() ? { remarks: remarks.trim() } : {}),
    };
    const callbacks = {
      onSuccess: (saved: RfqDetail) => {
        toast.success(rfq ? 'RFQ updated' : 'RFQ created', saved.number);
        router.push(`/procurement/rfqs/${saved.id}`);
      },
      onError: (error: unknown) =>
        setServerError(
          saveErrorMessage(error),
        ),
    };
    if (rfq) update.mutate(common, callbacks);
    else create.mutate({ requisitionId, ...common } satisfies RfqInput, callbacks);
  }

  return (
    <PermissionGate module="procurement.rfq" action={rfq ? 'EDIT' : 'CREATE'}>
      <PageHeader
        title={rfq ? `Edit ${rfq.number}` : 'New request for quotation'}
        description="Pick the requisition lines to source and the suppliers to invite. The RFQ is a draft until you send it."
        breadcrumbs={[
          { label: 'Procurement' },
          { label: 'RFQs', href: '/procurement/rfqs' },
          { label: rfq ? rfq.number : 'New' },
        ]}
      />
      <form onSubmit={submit} noValidate className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-4">
          {serverError ? <Alert tone="danger">{serverError}</Alert> : null}
          <Panel title="Requisition">
            <div className="space-y-3">
              <FormField label="Approved requisition" required error={showErrors ? errors.requisition : undefined}>
                {(field) => (
                  <EntityCombobox
                    entity="open-requisitions"
                    id={field.id}
                    search={searchOpenRequisitions}
                    value={requisitionId || null}
                    {...(pr ? { selectedLabel: `${pr.number} · ${pr.project.name}` } : {})}
                    onChange={(value) => setRequisitionId(value ?? '')}
                    disabled={Boolean(rfq)}
                    clearable={!rfq}
                    placeholder="Search approved requisitions"
                    aria-invalid={field['aria-invalid']}
                    aria-describedby={field['aria-describedby']}
                  />
                )}
              </FormField>
              {pr ? (
                <DetailList
                  columns={3}
                  items={[
                    { label: 'Project', value: `${pr.project.code} · ${pr.project.name}` },
                    { label: 'Status', value: <StatusBadge status={prStatusKey(pr.status)} /> },
                    { label: 'Needed by', value: formatDate(pr.requiredDate) },
                  ]}
                />
              ) : null}
            </div>
          </Panel>

          <Panel title="Lines to source" description="Quantities default to what has not been ordered yet." bodyClassName="p-0">
            {!requisitionId ? (
              <p className="px-4 py-6 text-sm text-muted-foreground">Choose a requisition to see its lines.</p>
            ) : requisition.isPending ? (
              <p className="px-4 py-6 text-sm text-muted-foreground">Loading lines…</p>
            ) : requisition.isError ? (
              <p className="px-4 py-6 text-sm text-danger">{errorMessage(requisition.error)}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-surface-muted text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="w-10 px-3 py-2" />
                      <th className="px-2 py-2 font-medium">Item</th>
                      <th className="px-2 py-2 text-right font-medium">Requested</th>
                      <th className="px-2 py-2 text-right font-medium">Open</th>
                      <th className="w-32 px-2 py-2 text-right font-medium">Quantity to quote</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pr?.lines.map((line) => {
                      const choice = choices.find((entry) => entry.requisitionLineId === line.id);
                      const open = Number(line.remainingQty) > 0 || Boolean(rfq?.lines.some((l) => l.requisitionLineId === line.id));
                      if (!choice) return null;
                      return (
                        <tr key={line.id} className="border-t border-border">
                          <td className="px-3 py-1.5">
                            <Checkbox
                              aria-label={`Include ${line.item.name}`}
                              checked={choice.selected}
                              disabled={!open}
                              onCheckedChange={(checked) => patchChoice(line.id, { selected: checked === true })}
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            <p className="font-medium">{line.item.name}</p>
                            <p className="font-mono text-xs text-muted-foreground">{line.item.sku}</p>
                          </td>
                          <td className="num px-2 py-1.5 text-right">{formatQty(line.qty, line.unit)}</td>
                          <td className="num px-2 py-1.5 text-right">{open ? formatQty(line.remainingQty, line.unit) : <Badge>Fully ordered</Badge>}</td>
                          <td className="px-2 py-1.5">
                            <Input
                              aria-label={`Quantity to quote for ${line.item.name}`}
                              inputMode="decimal"
                              disabled={!choice.selected}
                              value={choice.qty}
                              aria-invalid={showErrors && qtyErrors[line.id] ? true : undefined}
                              onChange={(event) => patchChoice(line.id, { qty: event.target.value.replace(/[^\d.]/g, '') })}
                              className="num h-8 text-right"
                            />
                            {showErrors && qtyErrors[line.id] ? <p className="text-2xs font-medium text-danger">{qtyErrors[line.id]}</p> : null}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {showErrors && errors.lines && requisitionId ? <p className="px-4 pb-3 text-xs font-medium text-danger">{errors.lines}</p> : null}
          </Panel>

          <Panel title="Suppliers to invite">
            <div className="space-y-3">
              <FormField label="Add a supplier" error={showErrors ? errors.suppliers : undefined}>
                {(field) => (
                  <EntityCombobox
                    entity="suppliers-rfq"
                    id={field.id}
                    search={searchSupplierOptions}
                    value={null}
                    onChange={(value, option) => {
                      if (!value || !option || suppliers.some((supplier) => supplier.id === value)) return;
                      setSuppliers((current) => [...current, { id: value, name: option.label }]);
                    }}
                    placeholder="Search suppliers by name or code"
                    clearable={false}
                    aria-invalid={field['aria-invalid']}
                    aria-describedby={field['aria-describedby']}
                  />
                )}
              </FormField>
              {suppliers.length > 0 ? (
                <ul className="flex flex-wrap gap-2" aria-label="Invited suppliers">
                  {suppliers.map((supplier) => (
                    <li key={supplier.id} className="inline-flex h-7 items-center gap-1 rounded border border-border bg-surface-muted pl-2.5 pr-1 text-sm">
                      {supplier.name}
                      <IconButton
                        label={`Remove ${supplier.name}`}
                        size="sm"
                        className="size-5"
                        onClick={() => setSuppliers((current) => current.filter((entry) => entry.id !== supplier.id))}
                      >
                        <X className="size-3" aria-hidden />
                      </IconButton>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">Invite two or three suppliers so the quotations can be compared.</p>
              )}
            </div>
          </Panel>

          <Panel title="Terms">
            <div className="grid gap-3 sm:grid-cols-2">
              <TextField label="Quotations due by" type="date" required value={dueDate} min={rfq ? undefined : manilaToday()} error={showErrors ? errors.dueDate : undefined} onChange={(e) => setDueDate(e.target.value)} />
              <TextField label="Goods needed by" type="date" value={requiredDate} onChange={(e) => setRequiredDate(e.target.value)} />
              <TextField label="Delivery location" className="sm:col-span-2" value={deliveryLocation} onChange={(e) => setDeliveryLocation(e.target.value)} />
              <TextAreaField label="Delivery requirements" wide value={deliveryRequirements} onChange={(e) => setDeliveryRequirements(e.target.value)} />
              <TextAreaField label="Notes to suppliers" wide value={remarks} onChange={(e) => setRemarks(e.target.value)} />
            </div>
          </Panel>
        </div>
        <aside className="space-y-3 xl:sticky xl:top-0 xl:self-start">
          <Panel title="Summary">
            <DetailList
              columns={2}
              className="sm:grid-cols-2 lg:grid-cols-2"
              items={[
                { label: 'Lines', value: selected.length, numeric: true },
                { label: 'Suppliers', value: suppliers.length, numeric: true },
                { label: 'Quotes due', value: dueDate ? formatDate(dueDate) : null },
                { label: 'Status', value: 'Draft' },
              ]}
            />
          </Panel>
          <div className="flex flex-col gap-2">
            <Button type="submit" variant="primary" loading={pending}>
              {rfq ? 'Save changes' : 'Create RFQ'}
            </Button>
            <Button asChild variant="ghost" disabled={pending}>
              <Link href={rfq ? `/procurement/rfqs/${rfq.id}` : '/procurement/rfqs'}>Cancel</Link>
            </Button>
          </div>
        </aside>
      </form>
    </PermissionGate>
  );
}
