import Link from 'next/link';
import * as React from 'react';
import { StatusBadge } from '@/components/common/status-badge';
import { subDecimal } from '@/lib/decimal';
import type { CompanyDto, PurchaseOrderDetail } from '@/lib/api/types';
import { formatDate, formatPHP, formatQty } from '@/lib/format';
import { cn } from '@/lib/utils';

function Party({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
      <div className="mt-1 space-y-0.5 text-sm">{children}</div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm">{value || '—'}</dd>
    </div>
  );
}

/**
 * The purchase order as a business document: parties, key dates, line items and totals. The same component
 * is shown on screen and, by itself, when the page is printed.
 */
export function PoDocument({
  po,
  company,
  linkParties = true,
  className,
}: {
  po: PurchaseOrderDetail;
  company: CompanyDto | undefined;
  linkParties?: boolean;
  className?: string;
}) {
  const net = subDecimal(po.subtotal, po.discount);
  const companyName = company ? (company.tradeName ?? company.legalName) : null;
  return (
    <article
      className={cn('rounded-lg border border-border bg-surface print:rounded-none print:border-0', className)}
      aria-label={`Purchase order ${po.number}`}
    >
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border px-6 py-5">
        <div>
          {companyName ? (
            <>
              <p className="text-base font-semibold">{companyName}</p>
              {company?.address ? <p className="max-w-xs text-xs text-muted-foreground">{company.address}</p> : null}
              {company?.tin ? <p className="text-xs text-muted-foreground">TIN {company.tin}</p> : null}
            </>
          ) : null}
        </div>
        <div className="text-right">
          <p className="text-2xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Purchase order</p>
          <p className="mt-0.5 font-mono text-2xl font-semibold leading-none tracking-tight">{po.number}</p>
          <div className="mt-2 flex justify-end print:hidden">
            <StatusBadge status={po.status} />
          </div>
          <p className="mt-2 hidden text-xs uppercase tracking-wide text-muted-foreground print:block">
            Status: {po.status.replace(/_/g, ' ')}
          </p>
        </div>
      </header>

      <div className="grid gap-6 border-b border-border px-6 py-5 sm:grid-cols-3">
        <Party title="Supplier">
          <p className="font-medium">
            {linkParties ? (
              <Link href={`/procurement/suppliers/${po.supplierId}`} className="hover:underline">
                {po.supplier.name}
              </Link>
            ) : (
              po.supplier.name
            )}
          </p>
          <p className="font-mono text-xs text-muted-foreground">{po.supplier.code}</p>
          {po.supplier.tin ? <p className="text-xs text-muted-foreground">TIN {po.supplier.tin}</p> : null}
        </Party>
        <Party title="Deliver to">
          <p className="font-medium">{po.warehouse.name}</p>
          <p className="font-mono text-xs text-muted-foreground">{po.warehouse.code}</p>
          {po.deliveryLocation ? <p className="text-xs text-muted-foreground">{po.deliveryLocation}</p> : null}
        </Party>
        <Party title="Charged to project">
          <p className="font-medium">
            {linkParties ? (
              <Link href={`/projects/${po.projectId}`} className="hover:underline">
                {po.project.name}
              </Link>
            ) : (
              po.project.name
            )}
          </p>
          <p className="font-mono text-xs text-muted-foreground">{po.project.code}</p>
          {po.requisition ? <p className="text-xs text-muted-foreground">Requisition {po.requisition.number}</p> : null}
          {po.rfq ? <p className="text-xs text-muted-foreground">RFQ {po.rfq.number}</p> : null}
        </Party>
      </div>

      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 border-b border-border px-6 py-4 sm:grid-cols-4">
        <Meta label="Order date" value={formatDate(po.orderDate)} />
        <Meta label="Expected delivery" value={po.expectedDate ? formatDate(po.expectedDate) : null} />
        <Meta label="Payment terms" value={po.paymentTerms ?? (po.supplier.paymentTermsDays ? `Net ${po.supplier.paymentTermsDays} days` : null)} />
        <Meta label="Currency" value={po.currency} />
      </dl>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[40rem] text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-muted/60 text-left text-2xs uppercase tracking-wider text-muted-foreground print:bg-transparent">
              <th className="w-10 px-6 py-2 font-semibold">#</th>
              <th className="px-2 py-2 font-semibold">Item</th>
              <th className="px-2 py-2 text-right font-semibold">Qty</th>
              <th className="px-2 py-2 font-semibold">Unit</th>
              <th className="px-2 py-2 text-right font-semibold">Unit price</th>
              <th className="px-2 py-2 text-right font-semibold">Disc.</th>
              <th className="px-6 py-2 text-right font-semibold">Amount</th>
            </tr>
          </thead>
          <tbody>
            {po.lines.map((line) => (
              <tr key={line.id} className="border-b border-border align-top last:border-0">
                <td className="num px-6 py-2 text-muted-foreground">{line.lineNo}</td>
                <td className="px-2 py-2">
                  <p className="font-medium">{line.item.name}</p>
                  <p className="font-mono text-xs text-muted-foreground">{line.item.sku}</p>
                  {line.description && line.description !== line.item.name ? <p className="text-xs text-muted-foreground">{line.description}</p> : null}
                  {line.deliveryDate ? <p className="text-xs text-muted-foreground">Deliver by {formatDate(line.deliveryDate)}</p> : null}
                </td>
                <td className="num px-2 py-2 text-right">{formatQty(line.qty)}</td>
                <td className="px-2 py-2 font-mono text-xs">{line.unit}</td>
                <td className="num px-2 py-2 text-right">{formatPHP(line.unitPrice, { symbol: false })}</td>
                <td className="num px-2 py-2 text-right text-muted-foreground">
                  {Number(line.discountPct) > 0 ? `${formatQty(line.discountPct, undefined, 2)}%` : '—'}
                </td>
                <td className="num px-6 py-2 text-right font-medium">{formatPHP(line.lineTotal, { symbol: false })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-6 border-t border-border px-6 py-4">
        <div className="max-w-md text-sm">
          {po.terms ? (
            <>
              <p className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">Terms and conditions</p>
              <p className="mt-1 whitespace-pre-wrap text-sm">{po.terms}</p>
            </>
          ) : null}
        </div>
        <dl className="num grid min-w-64 grid-cols-[1fr_auto] gap-x-8 gap-y-1 text-sm">
          <dt className="text-muted-foreground">Subtotal</dt>
          <dd className="text-right">{formatPHP(po.subtotal)}</dd>
          {Number(po.discount) > 0 ? (
            <>
              <dt className="text-muted-foreground">Less discount</dt>
              <dd className="text-right">({formatPHP(po.discount, { symbol: false })})</dd>
              <dt className="text-muted-foreground">Net of discount</dt>
              <dd className="text-right">{formatPHP(net)}</dd>
            </>
          ) : null}
          <dt className="text-muted-foreground">VAT</dt>
          <dd className="text-right">{formatPHP(po.taxAmount)}</dd>
          {Number(po.freight) > 0 ? (
            <>
              <dt className="text-muted-foreground">Freight</dt>
              <dd className="text-right">{formatPHP(po.freight)}</dd>
            </>
          ) : null}
          <dt className="border-t border-border-strong pt-1.5 text-base font-semibold">Total</dt>
          <dd className="border-t border-border-strong pt-1.5 text-right text-base font-semibold">{formatPHP(po.totalAmount)}</dd>
        </dl>
      </div>

      <div className="hidden grid-cols-3 gap-8 px-6 pb-8 pt-12 text-xs text-muted-foreground print:grid">
        {['Prepared by', 'Approved by', 'Received by supplier'].map((label) => (
          <div key={label} className="border-t border-foreground pt-1">
            {label}
          </div>
        ))}
      </div>
    </article>
  );
}
