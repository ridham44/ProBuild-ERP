'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { QueryErrorState } from '@/components/common/error-state';
import { EntityCombobox } from '@/components/common/entity-combobox';
import { FormField } from '@/components/common/form-field';
import { Panel } from '@/components/common/panel';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/toast';
import { searchIssuableRequestOptions, useMaterialRequest } from '@/features/material-requests/api/hooks';
import { saveErrorMessage } from '@/lib/api/errors';
import type { MaterialRequestDetail } from '@/lib/api/types';
import { compareDecimal } from '@/lib/decimal';
import { formatQty, manilaToday } from '@/lib/format';
import { useCreateMaterialIssue, type MaterialIssueInput } from '../api/hooks';
import { blankDelivery, deliveryPayload, IssueDeliveryFields, type IssueDelivery } from './issue-delivery-fields';

const QTY = /^\d+(\.\d{1,4})?$/;

function lineError(qty: string, remaining: string): string | undefined {
  if (qty === '') return undefined;
  if (!QTY.test(qty) || Number(qty) <= 0) return 'Above 0, up to 4 decimals';
  if (compareDecimal(qty, remaining) > 0) return `At most ${formatQty(remaining)} is left`;
  return undefined;
}

function IssueLines({
  request,
  quantities,
  showErrors,
  onChange,
}: {
  request: MaterialRequestDetail;
  quantities: Record<string, string>;
  showErrors: boolean;
  onChange: (lineId: string, qty: string) => void;
}) {
  return (
    <Panel title="Lines" description="Clear the quantity of a line you are not issuing now. Batches and serials are picked automatically." bodyClassName="p-0">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[40rem] text-sm">
          <thead className="bg-surface-muted text-left text-xs font-semibold text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-medium">Item</th>
              <th className="px-2 py-2 text-right font-medium">Approved</th>
              <th className="px-2 py-2 text-right font-medium">Left to issue</th>
              <th className="px-2 py-2 text-right font-medium">In stock</th>
              <th className="w-36 px-2 py-2 text-right font-medium">Issue now</th>
            </tr>
          </thead>
          <tbody>
            {request.lines
              .filter((line) => Number(line.remainingQty) > 0)
              .map((line) => {
                const error = showErrors ? lineError(quantities[line.id] ?? '', line.remainingQty) : undefined;
                return (
                  <tr key={line.id} className="border-t border-border align-top">
                    <td className="px-4 py-2">
                      <p className="font-medium">{line.item.name}</p>
                      <p className="font-mono text-xs text-muted-foreground">{line.item.sku}</p>
                    </td>
                    <td className="num px-2 py-2 text-right">{formatQty(line.approvedQty, line.unit)}</td>
                    <td className="num px-2 py-2 text-right">{formatQty(line.remainingQty)}</td>
                    <td className="num px-2 py-2 text-right">{formatQty(line.stock.available, line.item.baseUnit)}</td>
                    <td className="px-2 py-1.5">
                      <Input
                        aria-label={`Quantity to issue for ${line.item.name}`}
                        inputMode="decimal"
                        value={quantities[line.id] ?? ''}
                        aria-invalid={error ? true : undefined}
                        onChange={(event) => onChange(line.id, event.target.value.replace(/[^\d.]/g, ''))}
                        className="num text-right"
                      />
                      {error ? <p className="text-2xs font-medium text-danger">{error}</p> : null}
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

/** Issue against an approved request, limited to what is still approved and not yet issued. */
export function RequestIssueForm({ initialRequestId }: { initialRequestId: string }) {
  const router = useRouter();
  const create = useCreateMaterialIssue();
  const [requestId, setRequestId] = React.useState(initialRequestId);
  const request = useMaterialRequest(requestId, Boolean(requestId));
  const [quantities, setQuantities] = React.useState<Record<string, string>>({});
  const [delivery, setDelivery] = React.useState<IssueDelivery>(() => blankDelivery(manilaToday()));
  const [showErrors, setShowErrors] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(null);

  const data = request.data;
  React.useEffect(() => {
    if (!data) return;
    setQuantities(Object.fromEntries(data.lines.filter((line) => Number(line.remainingQty) > 0).map((line) => [line.id, line.remainingQty])));
  }, [data]);

  const chosen = data ? data.lines.filter((line) => (quantities[line.id] ?? '') !== '') : [];
  const valid = data !== undefined && chosen.length > 0 && chosen.every((line) => lineError(quantities[line.id] ?? '', line.remainingQty) === undefined);

  function submit(event: React.FormEvent): void {
    event.preventDefault();
    if (create.isPending || !data) return;
    setShowErrors(true);
    setServerError(null);
    if (!valid) return;
    const body: MaterialIssueInput = {
      requestId: data.id,
      ...deliveryPayload(delivery),
      lines: chosen.map((line) => ({ requestLineId: line.id, qty: quantities[line.id] ?? '', unit: line.unit })),
    };
    create.mutate(body, {
      onSuccess: (issue) => {
        toast.success('Material issue created', `${issue.number} is a draft. Review it, then post it.`);
        router.push(`/inventory/material-issues/${issue.id}`);
      },
      onError: (error) => setServerError(saveErrorMessage(error)),
    });
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <Panel title="Material request">
        <div className="max-w-md">
          <FormField label="Issue against" required>
            {(field) => (
              <EntityCombobox
                entity="issuable-requests"
                id={field.id}
                search={searchIssuableRequestOptions}
                value={requestId || null}
                {...(data ? { selectedLabel: data.number } : {})}
                onChange={(value) => setRequestId(value ?? '')}
                clearable={false}
                placeholder="Search approved requests"
              />
            )}
          </FormField>
        </div>
      </Panel>
      {!requestId ? null : request.isPending ? (
        <Skeleton className="h-48 w-full" />
      ) : request.isError ? (
        <QueryErrorState error={request.error} onRetry={() => void request.refetch()} />
      ) : data && data.status !== 'APPROVED' ? (
        <Alert tone="warning" title="This request cannot be issued against">
          {data.number} is {data.status.toLowerCase()}. Material can only be issued against an approved request.
        </Alert>
      ) : data ? (
        <>
          {serverError ? <Alert tone="danger">{serverError}</Alert> : null}
          {showErrors && chosen.length === 0 ? <Alert tone="warning">Enter a quantity for at least one line.</Alert> : null}
          <IssueLines
            request={data}
            quantities={quantities}
            showErrors={showErrors}
            onChange={(lineId, qty) => setQuantities((current) => ({ ...current, [lineId]: qty }))}
          />
          <IssueDeliveryFields
            value={delivery}
            onChange={(change) => setDelivery((current) => ({ ...current, ...change }))}
            remarksLabel="Remarks"
            remarksRequired={false}
          />
          <div className="flex gap-2">
            <Button type="submit" variant="primary" loading={create.isPending}>
              Create draft issue
            </Button>
            <Button asChild variant="ghost" disabled={create.isPending}>
              <Link href="/inventory/material-issues">Cancel</Link>
            </Button>
          </div>
        </>
      ) : null}
    </form>
  );
}
