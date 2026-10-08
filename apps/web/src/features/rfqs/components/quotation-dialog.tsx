'use client';

import * as React from 'react';
import { TextField } from '@/components/common/form-controls';
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
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/toast';
import { saveErrorMessage } from '@/lib/api/errors';
import type { RfqDetail } from '@/lib/api/types';
import { formatPHP, formatQty, manilaToday } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useCreateQuotation, useQuotation, useReviseQuotation } from '../api/hooks';
import {
  buildQuotationPayload,
  draftFromQuotation,
  quotationTotals,
  validateQuotation,
  type QuoteHeaderDraft,
  type QuoteLineDraft,
} from '../quotation-model';

const cell = 'h-8 px-2 text-right num';

function blankDraft(rfq: RfqDetail): { header: QuoteHeaderDraft; lines: QuoteLineDraft[] } {
  return {
    header: {
      quoteNo: '',
      quoteDate: manilaToday(),
      validUntil: '',
      deliveryDays: '',
      paymentTerms: '',
      warranty: '',
      freight: '',
      taxPct: '12',
    },
    lines: rfq.lines.map((line) => ({ rfqLineId: line.id, qty: '', unitPrice: '', discountPct: '', deliveryDate: '' })),
  };
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rfq: RfqDetail;
  supplierId: string;
  /** Existing quotation to revise, or null to enter a new one. */
  quotationId: string | null;
};

function Body({ rfq, supplierId, quotationId, onClose }: Omit<Props, 'open' | 'onOpenChange'> & { onClose: () => void }) {
  const supplier = rfq.suppliers.find((entry) => entry.supplierId === supplierId);
  const existing = useQuotation(quotationId ?? '', Boolean(quotationId));
  const create = useCreateQuotation(rfq.id);
  const revise = useReviseQuotation(rfq.id, quotationId ?? '');
  const [draft, setDraft] = React.useState(() => blankDraft(rfq));
  const [loadedFor, setLoadedFor] = React.useState<string | null>(null);
  const [showErrors, setShowErrors] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(null);
  const pending = create.isPending || revise.isPending;

  React.useEffect(() => {
    if (existing.data && loadedFor !== existing.data.id) {
      setDraft(draftFromQuotation(existing.data, rfq));
      setLoadedFor(existing.data.id);
    }
  }, [existing.data, loadedFor, rfq]);

  const { header, lines } = draft;
  const errors = validateQuotation(header, lines, rfq);
  const totals = quotationTotals(header, lines, rfq);
  const headerError = (key: keyof QuoteHeaderDraft) => (showErrors ? errors.header[key] : undefined);

  function setHeader(patch: Partial<QuoteHeaderDraft>): void {
    setDraft((current) => ({ ...current, header: { ...current.header, ...patch } }));
  }
  function setLine(rfqLineId: string, patch: Partial<QuoteLineDraft>): void {
    setDraft((current) => ({
      ...current,
      lines: current.lines.map((line) => (line.rfqLineId === rfqLineId ? { ...line, ...patch } : line)),
    }));
  }

  function submit(event: React.FormEvent): void {
    event.preventDefault();
    if (pending) return;
    setShowErrors(true);
    setServerError(null);
    if (!errors.valid) return;
    const payload = buildQuotationPayload(supplierId, header, lines);
    const callbacks = {
      onSuccess: () => {
        toast.success(quotationId ? 'Quotation revised' : 'Quotation recorded', supplier?.supplier.name);
        onClose();
      },
      onError: (error: unknown) => {
        setServerError(saveErrorMessage(error));
      },
    };
    if (quotationId) {
      const { supplierId: _supplier, ...body } = payload;
      void _supplier;
      revise.mutate(body, callbacks);
    } else create.mutate(payload, callbacks);
  }

  if (quotationId && existing.isPending) return <Skeleton className="m-4 h-64" />;

  return (
    <form onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col">
      <DialogBody className="space-y-4">
        {serverError ? <Alert tone="danger">{serverError}</Alert> : null}
        <div className="grid gap-3 sm:grid-cols-4">
          <TextField label="Supplier quote no." value={header.quoteNo} onChange={(e) => setHeader({ quoteNo: e.target.value })} />
          <TextField label="Quotation date" type="date" required value={header.quoteDate} error={headerError('quoteDate')} onChange={(e) => setHeader({ quoteDate: e.target.value })} />
          <TextField label="Valid until" type="date" value={header.validUntil} error={headerError('validUntil')} onChange={(e) => setHeader({ validUntil: e.target.value })} />
          <TextField label="Delivery (days)" inputMode="numeric" value={header.deliveryDays} error={headerError('deliveryDays')} onChange={(e) => setHeader({ deliveryDays: e.target.value.replace(/\D/g, '') })} />
          <TextField label="Payment terms" className="sm:col-span-2" value={header.paymentTerms} placeholder="e.g. 30 days after delivery" onChange={(e) => setHeader({ paymentTerms: e.target.value })} />
          <TextField label="Warranty" value={header.warranty} onChange={(e) => setHeader({ warranty: e.target.value })} />
          <TextField label="VAT (%)" inputMode="decimal" value={header.taxPct} error={headerError('taxPct')} hint="Applied to every line." onChange={(e) => setHeader({ taxPct: e.target.value.replace(/[^\d.]/g, '') })} />
        </div>
        <div>
          <div className="mb-1 flex items-baseline justify-between">
            <h3 className="text-sm font-semibold">Prices</h3>
            <p className="text-xs text-muted-foreground">Leave a unit price blank to skip a line the supplier did not quote.</p>
          </div>
          {showErrors && errors.header.lines ? <p className="mb-1 text-xs font-medium text-danger">{errors.header.lines}</p> : null}
          <div className="overflow-x-auto rounded border border-border">
            <table className="w-full min-w-[44rem] text-sm">
              <thead className="bg-surface-muted text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-2 py-1.5 font-medium">Item</th>
                  <th className="w-28 px-2 py-1.5 text-right font-medium">Required</th>
                  <th className="w-28 px-2 py-1.5 text-right font-medium">Qty offered</th>
                  <th className="w-32 px-2 py-1.5 text-right font-medium">Unit price</th>
                  <th className="w-20 px-2 py-1.5 text-right font-medium">Disc. %</th>
                  <th className="w-36 px-2 py-1.5 font-medium">Delivery date</th>
                </tr>
              </thead>
              <tbody>
                {rfq.lines.map((rfqLine) => {
                  const line = lines.find((entry) => entry.rfqLineId === rfqLine.id);
                  if (!line) return null;
                  const lineErrors = showErrors ? (errors.lines[line.rfqLineId] ?? {}) : {};
                  return (
                    <tr key={rfqLine.id} className="border-t border-border align-top">
                      <td className="px-2 py-1.5">
                        <p className="font-medium">{rfqLine.item.name}</p>
                        <p className="font-mono text-xs text-muted-foreground">{rfqLine.item.sku}</p>
                      </td>
                      <td className="num px-2 py-1.5 text-right">{formatQty(rfqLine.qty, rfqLine.unit)}</td>
                      <td className="px-2 py-1.5">
                        <Input aria-label={`Quantity offered for ${rfqLine.item.name}`} inputMode="decimal" placeholder={rfqLine.qty} value={line.qty} aria-invalid={lineErrors.qty ? true : undefined} onChange={(e) => setLine(line.rfqLineId, { qty: e.target.value.replace(/[^\d.]/g, '') })} className={cell} />
                        {lineErrors.qty ? <p className="text-2xs font-medium text-danger">{lineErrors.qty}</p> : null}
                      </td>
                      <td className="px-2 py-1.5">
                        <Input aria-label={`Unit price for ${rfqLine.item.name}`} inputMode="decimal" value={line.unitPrice} aria-invalid={lineErrors.unitPrice ? true : undefined} onChange={(e) => setLine(line.rfqLineId, { unitPrice: e.target.value.replace(/[^\d.]/g, '') })} className={cell} />
                        {lineErrors.unitPrice ? <p className="text-2xs font-medium text-danger">{lineErrors.unitPrice}</p> : null}
                      </td>
                      <td className="px-2 py-1.5">
                        <Input aria-label={`Discount percent for ${rfqLine.item.name}`} inputMode="decimal" value={line.discountPct} aria-invalid={lineErrors.discountPct ? true : undefined} onChange={(e) => setLine(line.rfqLineId, { discountPct: e.target.value.replace(/[^\d.]/g, '') })} className={cell} />
                      </td>
                      <td className="px-2 py-1.5">
                        <Input aria-label={`Delivery date for ${rfqLine.item.name}`} type="date" value={line.deliveryDate} onChange={(e) => setLine(line.rfqLineId, { deliveryDate: e.target.value })} className={cn('h-8 px-2 text-xs')} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <TextField label="Freight (PHP)" className="w-40" inputMode="decimal" value={header.freight} error={headerError('freight')} onChange={(e) => setHeader({ freight: e.target.value.replace(/[^\d.]/g, '') })} />
          <dl className="num grid grid-cols-[auto_auto] gap-x-6 gap-y-0.5 text-sm">
            <dt className="text-muted-foreground">Subtotal after discount</dt>
            <dd className="text-right">{formatPHP(totals.subtotal)}</dd>
            <dt className="text-muted-foreground">VAT</dt>
            <dd className="text-right">{formatPHP(totals.tax)}</dd>
            <dt className="text-muted-foreground">Freight</dt>
            <dd className="text-right">{formatPHP(totals.freight)}</dd>
            <dt className="font-semibold">Quotation total</dt>
            <dd className="text-right font-semibold">{formatPHP(totals.total)}</dd>
          </dl>
        </div>
      </DialogBody>
      <DialogFooter>
        <Button onClick={onClose} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" loading={pending}>
          {quotationId ? 'Save revision' : 'Record quotation'}
        </Button>
      </DialogFooter>
    </form>
  );
}

/** Enter a supplier's quotation against an RFQ, or revise one already entered. */
export function QuotationDialog({ open, onOpenChange, rfq, supplierId, quotationId }: Props) {
  const supplier = rfq.suppliers.find((entry) => entry.supplierId === supplierId);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg" className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>
            {quotationId ? 'Revise quotation' : 'Enter quotation'}: {supplier?.supplier.name}
          </DialogTitle>
          <DialogDescription>
            Record what the supplier offered for {rfq.number}. Totals are calculated by the server on save.
          </DialogDescription>
        </DialogHeader>
        {open ? <Body rfq={rfq} supplierId={supplierId} quotationId={quotationId} onClose={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}
