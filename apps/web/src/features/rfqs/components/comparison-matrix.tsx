'use client';

import { Award, Check, Clock, Star } from 'lucide-react';
import * as React from 'react';
import { StatusBadge } from '@/components/common/status-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { Comparison } from '@/lib/api/types';
import { formatDate, formatPHP, formatQty } from '@/lib/format';
import { cn } from '@/lib/utils';
import {
  awardable,
  buildMatrix,
  HIGHLIGHT_LABEL,
  offerHighlights,
  varianceLabel,
  whyNotAwardable,
  type ComparisonOffer,
  type ComparisonSupplier,
} from '../comparison-model';

const th = 'border-b border-border bg-surface-muted px-3 py-2 text-left align-bottom font-medium';

function OfferCell({ offer, unit }: { offer: ComparisonOffer | null; unit: string }) {
  if (!offer) {
    return <span className="text-sm text-subtle-foreground">No quote</span>;
  }
  const highlights = offerHighlights(offer);
  const variance = varianceLabel(offer.varianceFromLowestPct, offer.isLowestPrice);
  return (
    <div className="space-y-0.5">
      <p className={cn('num text-right text-sm', offer.isLowestPrice ? 'font-semibold text-approved' : 'font-medium')}>
        {formatPHP(offer.netUnitPrice)}
      </p>
      <p className="num text-right text-xs text-muted-foreground">
        {formatQty(offer.qty)} {unit} · {formatPHP(offer.lineTotal)}
      </p>
      <p className="num text-right text-xs text-muted-foreground">
        {offer.deliveryDate ? `Delivers ${formatDate(offer.deliveryDate)}` : 'No delivery date'}
      </p>
      {highlights.length > 0 || (variance && variance !== 'Lowest') ? (
        <p className="flex flex-wrap justify-end gap-1 pt-0.5">
          {highlights.includes('lowest-price') ? (
            <span className="inline-flex items-center gap-0.5 text-2xs font-medium text-approved">
              <Check className="size-3" aria-hidden />
              {HIGHLIGHT_LABEL['lowest-price']}
            </span>
          ) : null}
          {highlights.includes('fastest-delivery') ? (
            <span className="inline-flex items-center gap-0.5 text-2xs font-medium text-info">
              <Clock className="size-3" aria-hidden />
              {HIGHLIGHT_LABEL['fastest-delivery']}
            </span>
          ) : null}
          {highlights.includes('preferred') ? (
            <span className="inline-flex items-center gap-0.5 text-2xs font-medium text-pending">
              <Star className="size-3" aria-hidden />
              {HIGHLIGHT_LABEL.preferred}
            </span>
          ) : null}
          {highlights.includes('short-quote') ? (
            <span className="text-2xs font-medium text-warning">{HIGHLIGHT_LABEL['short-quote']}</span>
          ) : null}
          {variance && variance !== 'Lowest' ? (
            <span className="num text-2xs text-muted-foreground">{variance} vs lowest</span>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}

function SummaryRow({
  label,
  suppliers,
  render,
  strong,
}: {
  label: string;
  suppliers: ComparisonSupplier[];
  render: (supplier: ComparisonSupplier) => React.ReactNode;
  strong?: boolean;
}) {
  return (
    <tr className={strong ? 'bg-surface-muted/50' : undefined}>
      <th scope="row" colSpan={2} className="sticky left-0 border-b border-border bg-inherit px-3 py-1.5 text-left text-xs font-medium text-muted-foreground">
        {label}
      </th>
      {suppliers.map((supplier) => (
        <td key={supplier.supplierId} className={cn('num border-b border-border px-3 py-1.5 text-right text-sm', strong && 'font-semibold')}>
          {render(supplier)}
        </td>
      ))}
    </tr>
  );
}

/**
 * Item by supplier price matrix. Restrained colour: only the lowest price and lowest total carry a tint;
 * fastest delivery, preferred supplier and variance are text flags.
 */
export function ComparisonMatrix({
  comparison,
  canAward,
  onAward,
}: {
  comparison: Comparison;
  canAward: boolean;
  onAward: (supplier: ComparisonSupplier) => void;
}) {
  const rows = React.useMemo(() => buildMatrix(comparison), [comparison]);
  const { suppliers } = comparison;
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-surface">
      <table className="w-full min-w-[48rem] border-separate border-spacing-0 text-sm" aria-label="Supplier quotation comparison">
        <thead>
          <tr>
            <th scope="col" className={cn(th, 'sticky left-0 z-10 min-w-56 text-xs uppercase tracking-wide text-muted-foreground')}>
              Item
            </th>
            <th scope="col" className={cn(th, 'w-28 text-right text-xs uppercase tracking-wide text-muted-foreground')}>
              Required
            </th>
            {suppliers.map((supplier) => (
              <th key={supplier.supplierId} scope="col" className={cn(th, 'min-w-44')}>
                <p className="flex items-center justify-between gap-2 text-sm font-semibold">
                  <span className="truncate">{supplier.name}</span>
                  {supplier.status !== 'SUBMITTED' ? <StatusBadge status={supplier.status} /> : null}
                </p>
                <p className="mt-0.5 text-xs font-normal text-muted-foreground">
                  {supplier.quoteNo ? `${supplier.quoteNo} · ` : ''}
                  {formatDate(supplier.quoteDate)}
                </p>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ line, cells }) => (
            <tr key={line.rfqLineId} className="align-top">
              <th scope="row" className="sticky left-0 border-b border-border bg-surface px-3 py-2 text-left font-normal">
                <p className="font-medium">{line.item.name}</p>
                <p className="font-mono text-xs text-muted-foreground">{line.item.sku}</p>
              </th>
              <td className="num border-b border-border px-3 py-2 text-right">
                {formatQty(line.qty, line.unit)}
                {line.requiredDate ? <p className="text-xs text-muted-foreground">by {formatDate(line.requiredDate)}</p> : null}
              </td>
              {cells.map((cell) => (
                <td
                  key={cell.supplierId}
                  className={cn('border-b border-border px-3 py-2', cell.offer?.isLowestPrice && 'bg-approved-subtle/60')}
                >
                  <OfferCell offer={cell.offer} unit={line.unit} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <SummaryRow label="Subtotal" suppliers={suppliers} render={(s) => formatPHP(s.subtotal)} />
          <SummaryRow label="Discount" suppliers={suppliers} render={(s) => formatPHP(s.discountAmount)} />
          <SummaryRow label="Freight" suppliers={suppliers} render={(s) => formatPHP(s.freight)} />
          <SummaryRow label="VAT" suppliers={suppliers} render={(s) => formatPHP(s.taxAmount)} />
          <tr className="bg-surface-muted/50">
            <th scope="row" colSpan={2} className="sticky left-0 border-b border-border bg-inherit px-3 py-2 text-left text-sm font-semibold">
              Total
            </th>
            {suppliers.map((supplier) => (
              <td
                key={supplier.supplierId}
                className={cn('border-b border-border px-3 py-2 text-right', supplier.isLowestTotal && 'bg-approved-subtle')}
              >
                <p className={cn('num text-sm font-semibold', supplier.isLowestTotal && 'text-approved')}>
                  {formatPHP(supplier.totalAmount)}
                </p>
                <p className="num text-xs text-muted-foreground">
                  {supplier.isLowestTotal
                    ? 'Lowest total'
                    : (varianceLabel(supplier.varianceFromLowestTotalPct, false) ?? '')}
                </p>
              </td>
            ))}
          </tr>
          <SummaryRow
            label="Coverage"
            suppliers={suppliers}
            render={(s) => (
              <span className={cn(!s.coversAllLines && 'text-warning')}>
                {s.quotedLines} of {comparison.lines.length} lines
              </span>
            )}
          />
          <SummaryRow label="Delivery lead time" suppliers={suppliers} render={(s) => (s.deliveryDays === null ? '—' : `${s.deliveryDays} days`)} />
          <SummaryRow label="Payment terms" suppliers={suppliers} render={(s) => <span className="font-sans">{s.paymentTerms ?? '—'}</span>} />
          <SummaryRow
            label="Valid until"
            suppliers={suppliers}
            render={(s) => (
              <span className={cn(s.isExpired && 'font-medium text-overdue')}>
                {s.validUntil ? formatDate(s.validUntil) : 'Open'}
                {s.isExpired ? ' (expired)' : ''}
              </span>
            )}
          />
          <tr>
            <th scope="row" colSpan={2} className="sticky left-0 bg-surface px-3 py-2 text-left text-xs font-medium text-muted-foreground">
              Decision
            </th>
            {suppliers.map((supplier) => {
              const reason = whyNotAwardable(supplier);
              return (
                <td key={supplier.supplierId} className="px-3 py-2 text-right">
                  {supplier.status === 'AWARDED' ? (
                    <Badge tone="approved">
                      <Award className="size-3" aria-hidden />
                      Awarded
                    </Badge>
                  ) : canAward && awardable(supplier) ? (
                    <Button size="sm" variant={supplier.isLowestTotal ? 'primary' : 'secondary'} onClick={() => onAward(supplier)}>
                      Award to {supplier.code}
                    </Button>
                  ) : (
                    <span className="text-xs text-muted-foreground">{reason ?? ''}</span>
                  )}
                </td>
              );
            })}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
