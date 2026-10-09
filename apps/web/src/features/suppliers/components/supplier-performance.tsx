'use client';

import { createSupplierEvaluationSchema } from '@probuild/shared';
import { ClipboardCheck, Plus } from 'lucide-react';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { EmptyState } from '@/components/common/empty-state';
import { QueryErrorState } from '@/components/common/error-state';
import { TextAreaField, TextField } from '@/components/common/form-controls';
import { Panel } from '@/components/common/panel';
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
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/toast';
import type { SupplierPerformance } from '@/lib/api/types';
import { applyServerErrors, formResolver } from '@/lib/forms';
import { EMPTY_VALUE, formatDate, formatPHP, formatQty, manilaToday } from '@/lib/format';
import { useCreateEvaluation, useSupplierEvaluations, useSupplierPerformance } from '../api/hooks';

function pct(value: string | null): string {
  return value === null ? EMPTY_VALUE : `${Number(value).toFixed(1)}%`;
}

function score(value: string | null): string {
  return value === null ? EMPTY_VALUE : Number(value).toFixed(1);
}

function Metric({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="num mt-0.5 text-lg font-semibold leading-tight">{value}</dd>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function Metrics({ data }: { data: SupplierPerformance }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title="Orders">
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Metric label="Orders placed" value={data.orders.count} />
          <Metric label="Open orders" value={data.orders.openCount} />
          <Metric label="Total value" value={formatPHP(data.orders.totalValue)} />
          <Metric label="Last order" value={formatDate(data.orders.lastOrderDate)} />
        </dl>
      </Panel>
      <Panel title="Delivery and quality" description="Derived from posted goods receipts.">
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Metric label="Receipts" value={data.delivery.receiptCount} />
          <Metric
            label="On time"
            value={pct(data.delivery.onTimeRatePct)}
            hint={data.delivery.receiptCount > 0 ? `${data.delivery.onTimeCount} of ${data.delivery.receiptCount}` : 'No receipts yet'}
          />
          <Metric label="Received qty" value={formatQty(data.quality.receivedQty)} />
          <Metric label="Rejection rate" value={pct(data.quality.rejectionRatePct)} />
        </dl>
      </Panel>
      <Panel title="Sourcing" description="Response to RFQs.">
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-5">
          <Metric label="RFQs invited" value={data.sourcing.rfqsInvited} />
          <Metric label="Quotes submitted" value={data.sourcing.quotationsSubmitted} />
          <Metric label="Awards" value={data.sourcing.awards} />
          <Metric label="Response rate" value={pct(data.sourcing.responseRatePct)} />
          <Metric label="Win rate" value={pct(data.sourcing.winRatePct)} />
        </dl>
      </Panel>
      <Panel
        title="Evaluation scores"
        description={
          data.evaluations.count > 0
            ? `Average of ${data.evaluations.count} evaluation${data.evaluations.count === 1 ? '' : 's'}, scored 0 to 100.`
            : 'No evaluations recorded yet.'
        }
      >
        <dl className="grid grid-cols-3 gap-4 sm:grid-cols-6">
          <Metric label="Overall" value={score(data.evaluations.averages?.overall ?? null)} />
          <Metric label="Price" value={score(data.evaluations.averages?.price ?? null)} />
          <Metric label="Quality" value={score(data.evaluations.averages?.quality ?? null)} />
          <Metric label="Delivery" value={score(data.evaluations.averages?.delivery ?? null)} />
          <Metric label="Response" value={score(data.evaluations.averages?.responsiveness ?? null)} />
          <Metric label="Compliance" value={score(data.evaluations.averages?.compliance ?? null)} />
        </dl>
      </Panel>
    </div>
  );
}

type EvalValues = {
  periodStart: string;
  periodEnd: string;
  priceScore: number;
  qualityScore: number;
  deliveryScore: number;
  responsivenessScore: number;
  complianceScore: number;
  rejectionRatePct?: string;
  notes?: string;
};

const SCORE_FIELDS = [
  ['priceScore', 'Price'],
  ['qualityScore', 'Quality'],
  ['deliveryScore', 'Delivery'],
  ['responsivenessScore', 'Responsiveness'],
  ['complianceScore', 'Compliance'],
] as const;

function EvaluationDialog({
  open,
  onOpenChange,
  supplierId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplierId: string;
}) {
  const create = useCreateEvaluation(supplierId);
  const [formError, setFormError] = React.useState<string | null>(null);
  const today = manilaToday();
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors },
  } = useForm<EvalValues>({
    resolver: formResolver<EvalValues>(createSupplierEvaluationSchema),
    defaultValues: { periodStart: '', periodEnd: today },
  });
  React.useEffect(() => {
    if (open) {
      reset({ periodStart: '', periodEnd: today });
      setFormError(null);
    }
  }, [open, reset, today]);

  function submit(values: EvalValues): void {
    setFormError(null);
    create.mutate(values, {
      onSuccess: () => {
        toast.success('Evaluation recorded');
        onOpenChange(false);
      },
      onError: (error) =>
        setFormError(
          applyServerErrors(error, setError, [
            'periodStart',
            'periodEnd',
            'priceScore',
            'qualityScore',
            'deliveryScore',
            'responsivenessScore',
            'complianceScore',
            'rejectionRatePct',
            'notes',
          ] as const),
        ),
    });
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (create.isPending ? undefined : onOpenChange(next))}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>Record evaluation</DialogTitle>
          <DialogDescription>Score the supplier from 0 to 100 for the period under review.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(submit)} noValidate className="flex min-h-0 flex-1 flex-col">
          <DialogBody className="space-y-3">
            {formError ? <Alert tone="danger">{formError}</Alert> : null}
            <div className="grid gap-3 sm:grid-cols-2">
              <TextField label="Period start" type="date" required error={errors.periodStart?.message} {...register('periodStart')} />
              <TextField label="Period end" type="date" required error={errors.periodEnd?.message} {...register('periodEnd')} />
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {SCORE_FIELDS.map(([name, label]) => (
                <TextField
                  key={name}
                  label={label}
                  type="number"
                  min={0}
                  max={100}
                  required
                  inputMode="numeric"
                  error={errors[name]?.message}
                  {...register(name, { valueAsNumber: true })}
                />
              ))}
              <TextField
                label="Rejection rate (%)"
                inputMode="decimal"
                error={errors.rejectionRatePct?.message}
                {...register('rejectionRatePct')}
              />
            </div>
            <TextAreaField label="Notes" error={errors.notes?.message} {...register('notes')} />
          </DialogBody>
          <DialogFooter>
            <Button onClick={() => onOpenChange(false)} disabled={create.isPending}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={create.isPending}>
              Save evaluation
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Evaluations({ supplierId, canEdit }: { supplierId: string; canEdit: boolean }) {
  const evaluations = useSupplierEvaluations(supplierId);
  const [open, setOpen] = React.useState(false);
  const items = evaluations.data?.items ?? [];
  return (
    <Panel
      title="Evaluations"
      actions={
        canEdit ? (
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus className="size-3.5" aria-hidden />
            Record evaluation
          </Button>
        ) : null
      }
      bodyClassName="p-0"
    >
      {evaluations.isPending ? (
        <div className="p-4">
          <Skeleton className="h-16" />
        </div>
      ) : evaluations.isError ? (
        <QueryErrorState error={evaluations.error} onRetry={() => void evaluations.refetch()} compact />
      ) : items.length === 0 ? (
        <EmptyState
          compact
          icon={ClipboardCheck}
          title="No evaluations yet"
          description="Periodic scoring gives buyers a record beyond delivery statistics."
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-semibold text-muted-foreground">
                <th className="px-4 py-2 font-medium">Period</th>
                <th className="px-3 py-2 text-right font-medium">Price</th>
                <th className="px-3 py-2 text-right font-medium">Quality</th>
                <th className="px-3 py-2 text-right font-medium">Delivery</th>
                <th className="px-3 py-2 text-right font-medium">Response</th>
                <th className="px-3 py-2 text-right font-medium">Compliance</th>
                <th className="px-4 py-2 text-right font-medium">Rejection</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-2">
                    {formatDate(item.periodStart)} to {formatDate(item.periodEnd)}
                    {item.notes ? <p className="text-xs text-muted-foreground">{item.notes}</p> : null}
                  </td>
                  <td className="num px-3 py-2 text-right">{item.priceScore}</td>
                  <td className="num px-3 py-2 text-right">{item.qualityScore}</td>
                  <td className="num px-3 py-2 text-right">{item.deliveryScore}</td>
                  <td className="num px-3 py-2 text-right">{item.responsivenessScore}</td>
                  <td className="num px-3 py-2 text-right">{item.complianceScore}</td>
                  <td className="num px-4 py-2 text-right">{pct(item.rejectionRatePct)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <EvaluationDialog open={open} onOpenChange={setOpen} supplierId={supplierId} />
    </Panel>
  );
}

export function SupplierPerformancePanel({
  supplierId,
  canEdit,
}: {
  supplierId: string;
  canEdit: boolean;
}) {
  const performance = useSupplierPerformance(supplierId);
  return (
    <div className="space-y-4">
      {performance.isPending ? (
        <Skeleton className="h-48" />
      ) : performance.isError ? (
        <QueryErrorState error={performance.error} onRetry={() => void performance.refetch()} />
      ) : (
        <Metrics data={performance.data} />
      )}
      <Evaluations supplierId={supplierId} canEdit={canEdit} />
    </div>
  );
}
