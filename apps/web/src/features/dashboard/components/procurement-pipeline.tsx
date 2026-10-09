'use client';

import {
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  ShoppingCart,
  Truck,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { meterFillClass, type MeterTone } from '@/components/common/meter';
import { Panel } from '@/components/common/panel';
import { Skeleton } from '@/components/ui/skeleton';
import { useCan } from '@/features/auth/components/current-user';
import { usePurchaseOrders } from '@/features/purchase-orders/api/hooks';
import { useRequisitions } from '@/features/requisitions/api/hooks';
import { cn } from '@/lib/utils';
import { cappedCount, formatCappedCount, type CappedCount } from '../model';

const LIMIT = 100;

type Stage = {
  id: string;
  label: string;
  hint: string;
  href: string;
  icon: LucideIcon;
  tone: MeterTone;
  value: CappedCount | null;
  loading: boolean;
};

function StageCell({ stage, max, last }: { stage: Stage; max: number; last: boolean }) {
  const Icon = stage.icon;
  const share = stage.value && max > 0 ? (stage.value.count / max) * 100 : 0;
  return (
    <li className="relative flex min-w-0">
      <Link
        href={stage.href}
        className="group/stage flex min-w-0 flex-1 flex-col rounded-lg p-3 outline-none transition-colors hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <Icon className="size-3.5 shrink-0" strokeWidth={2} aria-hidden />
          <span className="truncate">{stage.label}</span>
        </span>
        {stage.loading ? (
          <Skeleton className="mt-2 h-7 w-12" />
        ) : (
          <span className="num mt-1.5 text-[1.75rem] font-semibold leading-none">
            {formatCappedCount(stage.value)}
          </span>
        )}
        <span className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-sunken" aria-hidden>
          <span
            className={cn('block h-full rounded-full', meterFillClass(stage.tone))}
            style={{ width: `${share}%` }}
          />
        </span>
        <span className="mt-2 text-xs text-subtle-foreground group-hover/stage:text-primary">
          {stage.hint}
        </span>
      </Link>
      {last ? null : (
        <ChevronRight
          className="absolute -right-2.5 top-1/2 z-[1] hidden size-4 -translate-y-1/2 text-border-strong lg:block"
          aria-hidden
        />
      )}
    </li>
  );
}

/** Live counts at each hand-off from request to delivery; bars compare stages against the busiest one. */
export function ProcurementPipeline() {
  const canPr = useCan('procurement.requisition', 'VIEW');
  const canPo = useCan('procurement.order', 'VIEW');
  const pendingPr = useRequisitions({ status: 'SUBMITTED', limit: LIMIT }, canPr);
  const approvedPr = useRequisitions({ status: 'APPROVED', limit: LIMIT }, canPr);
  const pendingPo = usePurchaseOrders({ status: 'PENDING_APPROVAL', limit: LIMIT }, canPo);
  const openPo = usePurchaseOrders({ status: 'SENT', limit: LIMIT }, canPo);
  if (!canPr && !canPo) return null;

  const stages: Stage[] = [
    ...(canPr
      ? [
          { id: 'pr-submitted', label: 'Requisitions in approval', hint: 'Awaiting a decision', href: '/procurement/requests', icon: ClipboardList, tone: 'pending' as const, value: cappedCount(pendingPr.data), loading: pendingPr.isPending },
          { id: 'pr-approved', label: 'Approved, not ordered', hint: 'Ready for RFQ or order', href: '/procurement/requests', icon: ClipboardCheck, tone: 'accent' as const, value: cappedCount(approvedPr.data), loading: approvedPr.isPending },
        ]
      : []),
    ...(canPo
      ? [
          { id: 'po-pending', label: 'Orders pending approval', hint: 'Purchase orders', href: '/procurement/orders', icon: ShoppingCart, tone: 'pending' as const, value: cappedCount(pendingPo.data), loading: pendingPo.isPending },
          { id: 'po-sent', label: 'Awaiting delivery', hint: 'Sent to suppliers', href: '/procurement/orders', icon: Truck, tone: 'primary' as const, value: cappedCount(openPo.data), loading: openPo.isPending },
        ]
      : []),
  ];
  const max = Math.max(0, ...stages.map((stage) => stage.value?.count ?? 0));

  return (
    <Panel
      title="Procurement pipeline"
      description="Live counts from requisitions and purchase orders, in the order work moves."
      bodyClassName="p-2"
    >
      <ol
        className={cn(
          'grid gap-1 sm:grid-cols-2',
          stages.length === 4 ? 'lg:grid-cols-4 lg:gap-5' : 'lg:grid-cols-2 lg:gap-5',
        )}
      >
        {stages.map((stage, index) => (
          <StageCell key={stage.id} stage={stage} max={max} last={index === stages.length - 1} />
        ))}
      </ol>
    </Panel>
  );
}
