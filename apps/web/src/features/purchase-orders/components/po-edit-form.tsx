'use client';

import { Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { EntityCombobox } from '@/components/common/entity-combobox';
import { TextAreaField, TextField } from '@/components/common/form-controls';
import { FormField } from '@/components/common/form-field';
import { PageHeader } from '@/components/common/page-header';
import { DetailList, Panel } from '@/components/common/panel';
import { Alert } from '@/components/ui/alert';
import { Button, IconButton } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/toast';
import { PermissionGate } from '@/features/auth/components/permission-gate';
import { searchWarehouseOptions } from '@/features/warehouses/api/hooks';
import { computeLineMoney, isDecimal, subDecimal, sumDecimal } from '@/lib/decimal';
import { saveErrorMessage } from '@/lib/api/errors';
import type { PurchaseOrderDetail } from '@/lib/api/types';
import { formatPHP } from '@/lib/format';
import { useUpdatePurchaseOrder } from '../api/hooks';

type LineDraft = {
  id: string;
  label: string;
  sku: string;
  unit: string;
  qty: string;
  unitPrice: string;
  discountPct: string;
  taxPct: string;
  deliveryDate: string;
  description: string;
};

const QTY = /^\d+(\.\d{1,4})?$/;

function lineProblems(line: LineDraft): Partial<Record<'qty' | 'unitPrice' | 'discountPct' | 'taxPct', string>> {
  const errors: Partial<Record<'qty' | 'unitPrice' | 'discountPct' | 'taxPct', string>> = {};
  if (!QTY.test(line.qty) || Number(line.qty) <= 0) errors.qty = 'Above 0, up to 4 decimals';
  if (!QTY.test(line.unitPrice)) errors.unitPrice = 'Up to 4 decimals';
  if (!isDecimal(line.discountPct || '0') || Number(line.discountPct || '0') > 100) errors.discountPct = '0 to 100';
  if (!isDecimal(line.taxPct || '0') || Number(line.taxPct || '0') > 100) errors.taxPct = '0 to 100';
  return errors;
}

export function PoEditForm({ po }: { po: PurchaseOrderDetail }) {
  const router = useRouter();
  const update = useUpdatePurchaseOrder(po.id);
  const [warehouseId, setWarehouseId] = React.useState(po.warehouseId);
  const [warehouseLabel, setWarehouseLabel] = React.useState(po.warehouse.name);
  const [orderDate, setOrderDate] = React.useState(po.orderDate.slice(0, 10));
  const [expectedDate, setExpectedDate] = React.useState(po.expectedDate ? po.expectedDate.slice(0, 10) : '');
  const [deliveryLocation, setDeliveryLocation] = React.useState(po.deliveryLocation ?? '');
  const [paymentTerms, setPaymentTerms] = React.useState(po.paymentTerms ?? '');
  const [terms, setTerms] = React.useState(po.terms ?? '');
  const [freight, setFreight] = React.useState(Number(po.freight) > 0 ? po.freight : '');
  const [lines, setLines] = React.useState<LineDraft[]>(() =>
    po.lines.map((line) => ({
      id: line.id,
      label: line.item.name,
      sku: line.item.sku,
      unit: line.unit,
      qty: line.qty,
      unitPrice: line.unitPrice,
      discountPct: Number(line.discountPct) > 0 ? line.discountPct : '',
      taxPct: line.taxPct,
      deliveryDate: line.deliveryDate ? line.deliveryDate.slice(0, 10) : '',
      description: line.description ?? '',
    })),
  );
  const [showErrors, setShowErrors] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(null);

  const monies = lines.map((line) =>
    computeLineMoney({ qty: line.qty || '0', unitPrice: line.unitPrice || '0', discountPct: line.discountPct || '0', taxPct: line.taxPct || '0' }),
  );
  const subtotal = sumDecimal(monies.map((money) => money.gross));
  const discount = sumDecimal(monies.map((money) => money.discount));
  const tax = sumDecimal(monies.map((money) => money.tax));
  const freightValue = isDecimal(freight || '0') ? freight || '0' : '0';
  const total = sumDecimal([subDecimal(subtotal, discount), tax, freightValue]);
  const problems = lines.map(lineProblems);
  const freightBad = freight !== '' && !/^\d+(\.\d{1,2})?$/.test(freight);
  const valid = lines.length > 0 && problems.every((entry) => Object.keys(entry).length === 0) && !freightBad && Boolean(warehouseId);

  function patch(id: string, change: Partial<LineDraft>): void {
    setLines((current) => current.map((line) => (line.id === id ? { ...line, ...change } : line)));
  }

  function submit(event: React.FormEvent): void {
    event.preventDefault();
    if (update.isPending) return;
    setShowErrors(true);
    setServerError(null);
    if (!valid) return;
    update.mutate(
      {
        warehouseId,
        orderDate,
        ...(expectedDate ? { expectedDate } : { expectedDate: null }),
        deliveryLocation: deliveryLocation.trim() || null,
        paymentTerms: paymentTerms.trim() || null,
        terms: terms.trim() || null,
        freight: freight || '0',
        lines: lines.map((line) => ({
          id: line.id,
          qty: line.qty,
          unitPrice: line.unitPrice,
          discountPct: line.discountPct || '0',
          taxPct: line.taxPct || '0',
          deliveryDate: line.deliveryDate || null,
          description: line.description.trim() || null,
        })),
      },
      {
        onSuccess: () => {
          toast.success('Purchase order updated', po.number);
          router.push(`/procurement/orders/${po.id}`);
        },
        onError: (error) => setServerError(saveErrorMessage(error)),
      },
    );
  }

  const cell = 'num h-8 px-2 text-right';
  return (
    <PermissionGate module="procurement.order" action="EDIT">
      <PageHeader
        title={`Edit ${po.number}`}
        description={`${po.supplier.name} · ${po.project.name}. Removing a line releases its quantity back to the requisition.`}
        breadcrumbs={[
          { label: 'Procurement' },
          { label: 'Purchase orders', href: '/procurement/orders' },
          { label: po.number, href: `/procurement/orders/${po.id}` },
          { label: 'Edit' },
        ]}
      />
      <form onSubmit={submit} noValidate className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-4">
          {serverError ? <Alert tone="danger">{serverError}</Alert> : null}
          <Panel title="Delivery and terms">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <FormField label="Deliver to warehouse" required>
                {(field) => (
                  <EntityCombobox
                    entity="warehouses"
                    id={field.id}
                    search={searchWarehouseOptions}
                    value={warehouseId || null}
                    selectedLabel={warehouseLabel}
                    onChange={(value, option) => {
                      setWarehouseId(value ?? '');
                      setWarehouseLabel(option?.label ?? '');
                    }}
                    clearable={false}
                  />
                )}
              </FormField>
              <TextField label="Order date" type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} />
              <TextField label="Expected delivery" type="date" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} />
              <TextField label="Delivery location" className="lg:col-span-2" value={deliveryLocation} onChange={(e) => setDeliveryLocation(e.target.value)} />
              <TextField label="Payment terms" value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} />
              <TextAreaField label="Terms and conditions" wide className="lg:col-span-3" value={terms} onChange={(e) => setTerms(e.target.value)} />
            </div>
          </Panel>
          <Panel title="Lines" bodyClassName="p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[52rem] text-sm">
                <thead className="bg-surface-muted text-left text-xs font-semibold text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 font-medium">Item</th>
                    <th className="w-28 px-2 py-2 text-right font-medium">Qty</th>
                    <th className="w-32 px-2 py-2 text-right font-medium">Unit price</th>
                    <th className="w-20 px-2 py-2 text-right font-medium">Disc. %</th>
                    <th className="w-20 px-2 py-2 text-right font-medium">VAT %</th>
                    <th className="w-36 px-2 py-2 font-medium">Deliver by</th>
                    <th className="w-28 px-2 py-2 text-right font-medium">Net amount</th>
                    <th className="w-10 px-2 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, index) => {
                    const errors = showErrors ? (problems[index] ?? {}) : {};
                    return (
                      <tr key={line.id} className="border-t border-border align-top">
                        <td className="px-4 py-1.5">
                          <p className="font-medium">{line.label}</p>
                          <p className="font-mono text-xs text-muted-foreground">{line.sku} · {line.unit}</p>
                        </td>
                        <td className="px-2 py-1.5">
                          <Input aria-label={`Quantity for ${line.label}`} inputMode="decimal" value={line.qty} aria-invalid={errors.qty ? true : undefined} onChange={(e) => patch(line.id, { qty: e.target.value.replace(/[^\d.]/g, '') })} className={cell} />
                          {errors.qty ? <p className="text-2xs font-medium text-danger">{errors.qty}</p> : null}
                        </td>
                        <td className="px-2 py-1.5">
                          <Input aria-label={`Unit price for ${line.label}`} inputMode="decimal" value={line.unitPrice} aria-invalid={errors.unitPrice ? true : undefined} onChange={(e) => patch(line.id, { unitPrice: e.target.value.replace(/[^\d.]/g, '') })} className={cell} />
                          {errors.unitPrice ? <p className="text-2xs font-medium text-danger">{errors.unitPrice}</p> : null}
                        </td>
                        <td className="px-2 py-1.5">
                          <Input aria-label={`Discount percent for ${line.label}`} inputMode="decimal" value={line.discountPct} onChange={(e) => patch(line.id, { discountPct: e.target.value.replace(/[^\d.]/g, '') })} className={cell} />
                        </td>
                        <td className="px-2 py-1.5">
                          <Input aria-label={`VAT percent for ${line.label}`} inputMode="decimal" value={line.taxPct} onChange={(e) => patch(line.id, { taxPct: e.target.value.replace(/[^\d.]/g, '') })} className={cell} />
                        </td>
                        <td className="px-2 py-1.5">
                          <Input aria-label={`Delivery date for ${line.label}`} type="date" value={line.deliveryDate} onChange={(e) => patch(line.id, { deliveryDate: e.target.value })} className="h-8 px-2 text-xs" />
                        </td>
                        <td className="num px-2 py-1.5 pt-3 text-right font-medium">{formatPHP(monies[index]?.net, { symbol: false })}</td>
                        <td className="px-1 py-1.5">
                          <IconButton label={`Remove ${line.label}`} size="sm" disabled={lines.length === 1} onClick={() => setLines((current) => current.filter((entry) => entry.id !== line.id))}>
                            <Trash2 className="size-3.5" aria-hidden />
                          </IconButton>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>
        <aside className="space-y-3 xl:sticky xl:top-0 xl:self-start">
          <Panel title="Totals">
            <TextField label="Freight (PHP)" inputMode="decimal" value={freight} error={showErrors && freightBad ? 'Up to 2 decimals' : undefined} onChange={(e) => setFreight(e.target.value.replace(/[^\d.]/g, ''))} />
            <DetailList
              className="mt-3 sm:grid-cols-1 lg:grid-cols-1"
              columns={2}
              items={[
                { label: 'Lines', value: `${lines.length} of ${po.lines.length}`, numeric: true },
                { label: 'Subtotal', value: formatPHP(subtotal), numeric: true },
                { label: 'Discount', value: formatPHP(discount), numeric: true },
                { label: 'VAT', value: formatPHP(tax), numeric: true },
                { label: 'Total', value: <span className="text-base font-semibold">{formatPHP(total)}</span>, numeric: true },
              ]}
            />
            <p className="mt-2 text-xs text-muted-foreground">The server recalculates and confirms these totals when you save.</p>
          </Panel>
          <div className="flex flex-col gap-2">
            <Button type="submit" variant="primary" loading={update.isPending}>
              Save changes
            </Button>
            <Button asChild variant="ghost" disabled={update.isPending}>
              <Link href={`/procurement/orders/${po.id}`}>Cancel</Link>
            </Button>
          </div>
        </aside>
      </form>
    </PermissionGate>
  );
}
