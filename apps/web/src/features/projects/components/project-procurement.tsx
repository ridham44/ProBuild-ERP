'use client';

import Link from 'next/link';
import * as React from 'react';
import { EmptyState } from '@/components/common/empty-state';
import { QueryErrorState } from '@/components/common/error-state';
import { Panel } from '@/components/common/panel';
import { StatusBadge } from '@/components/common/status-badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useCan } from '@/features/auth/components/current-user';
import { usePurchaseOrders } from '@/features/purchase-orders/api/hooks';
import { useRequisitions } from '@/features/requisitions/api/hooks';
import { prStatusKey } from '@/features/requisitions/model';
import { useRfqs } from '@/features/rfqs/api/hooks';
import { formatDate, formatPHP } from '@/lib/format';

const LIMIT = 8;

function Section({
  title,
  href,
  loading,
  error,
  onRetry,
  empty,
  children,
  action,
}: {
  title: string;
  href: string;
  loading: boolean;
  error: unknown;
  onRetry: () => void;
  empty: boolean;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <Panel
      title={title}
      bodyClassName="p-0"
      actions={
        <>
          {action}
          <Button asChild size="sm" variant="ghost">
            <Link href={href}>View all</Link>
          </Button>
        </>
      }
    >
      {loading ? (
        <div className="p-4">
          <Skeleton className="h-16" />
        </div>
      ) : error ? (
        <QueryErrorState error={error} onRetry={onRetry} compact />
      ) : empty ? (
        <EmptyState compact title={`No ${title.toLowerCase()} yet`} description="Documents raised for this project appear here." />
      ) : (
        <ul className="divide-y divide-border">{children}</ul>
      )}
    </Panel>
  );
}

/** Requisitions, RFQs and purchase orders of one project, newest first, from the same list endpoints as the main pages. */
export function ProjectProcurement({ projectId }: { projectId: string }) {
  const canRfq = useCan('procurement.rfq', 'VIEW', { projectId });
  const canPo = useCan('procurement.order', 'VIEW', { projectId });
  const canCreate = useCan('procurement.requisition', 'CREATE', { projectId });
  const requisitions = useRequisitions({ projectId, limit: LIMIT });
  const rfqs = useRfqs({ projectId, limit: LIMIT }, canRfq);
  const orders = usePurchaseOrders({ projectId, limit: LIMIT }, canPo);
  return (
    <div className="grid gap-4 xl:grid-cols-3">
      <Section
        title="Requisitions"
        href="/procurement/requests"
        loading={requisitions.isPending}
        error={requisitions.error}
        onRetry={() => void requisitions.refetch()}
        empty={(requisitions.data?.items ?? []).length === 0}
        action={
          canCreate ? (
            <Button asChild size="sm">
              <Link href="/procurement/requests/new">New</Link>
            </Button>
          ) : undefined
        }
      >
        {(requisitions.data?.items ?? []).map((pr) => (
          <li key={pr.id} className="space-y-0.5 px-4 py-2 text-sm">
            <div className="flex items-center gap-2">
              <Link href={`/procurement/requests/${pr.id}`} className="doc-link">
                {pr.number}
              </Link>
              <StatusBadge status={prStatusKey(pr.status)} />
              <span className="num ml-auto">{formatPHP(pr.estimatedTotal)}</span>
            </div>
            <p className="truncate text-xs text-muted-foreground">{pr.purpose ?? 'No purpose stated'}</p>
          </li>
        ))}
      </Section>
      {canRfq ? (
        <Section
          title="RFQs"
          href="/procurement/rfqs"
          loading={rfqs.isPending}
          error={rfqs.error}
          onRetry={() => void rfqs.refetch()}
          empty={(rfqs.data?.items ?? []).length === 0}
        >
          {(rfqs.data?.items ?? []).map((rfq) => (
            <li key={rfq.id} className="space-y-0.5 px-4 py-2 text-sm">
              <div className="flex items-center gap-2">
                <Link href={`/procurement/rfqs/${rfq.id}`} className="doc-link">
                  {rfq.number}
                </Link>
                <StatusBadge status={rfq.status} />
              </div>
              <p className="text-xs text-muted-foreground">
                {rfq._count.quotations} of {rfq._count.suppliers} quotes{rfq.dueDate ? ` · due ${formatDate(rfq.dueDate)}` : ''}
              </p>
            </li>
          ))}
        </Section>
      ) : null}
      {canPo ? (
        <Section
          title="Purchase orders"
          href="/procurement/orders"
          loading={orders.isPending}
          error={orders.error}
          onRetry={() => void orders.refetch()}
          empty={(orders.data?.items ?? []).length === 0}
        >
          {(orders.data?.items ?? []).map((po) => (
            <li key={po.id} className="space-y-0.5 px-4 py-2 text-sm">
              <div className="flex items-center gap-2">
                <Link href={`/procurement/orders/${po.id}`} className="doc-link">
                  {po.number}
                </Link>
                <StatusBadge status={po.status} />
                <span className="num ml-auto">{formatPHP(po.totalAmount)}</span>
              </div>
              <p className="truncate text-xs text-muted-foreground">{po.supplier.name}</p>
            </li>
          ))}
        </Section>
      ) : null}
    </div>
  );
}
