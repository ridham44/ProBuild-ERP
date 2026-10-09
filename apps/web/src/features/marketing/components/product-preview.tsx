import {
  Check,
  ClipboardCheck,
  Clock,
  FolderKanban,
  Info,
  Landmark,
  LayoutDashboard,
  PackageX,
  ShoppingCart,
  Warehouse,
} from 'lucide-react';
import { StatusBadge } from '@/components/common/status-badge';
import { cn } from '@/lib/utils';

/*
 * A marketing rendition of the project workspace, built in markup so it stays legible at any size. Every figure is
 * taken from the demo environment (prisma:seed:demo-data, project PRJ-2026-001) so the preview matches what a
 * visitor sees after signing in to the live demo. Update it if the demo seed changes.
 */

const KPIS = [
  { label: 'Budget', value: '₱12.11M', hint: 'Approved control budget' },
  { label: 'Committed', value: '₱250.5K', hint: 'Open purchase orders' },
  { label: 'Material actual', value: '₱237.7K', hint: 'Issued, net of returns', accent: true },
] as const;

/** Budget vs actual by cost code. Bar widths are each line's actual and committed share of its budget. */
const COST_LINES = [
  { code: 'MAT-STL', name: 'Reinforcing steel & formwork', budget: '₱5.86M', actual: 'w-[1.4%]', committed: 'w-[4.3%]', used: '5.6%' },
  { code: 'MAT-CON', name: 'Concrete & masonry', budget: '₱5.46M', actual: 'w-[2.9%]', committed: 'w-0', used: '2.9%' },
  { code: 'MAT-ELE', name: 'Electrical materials', budget: '₱462K', actual: 'w-0', committed: 'w-0', used: '0%' },
  { code: 'MAT-PLB', name: 'Plumbing materials', budget: '₱324K', actual: 'w-0', committed: 'w-0', used: '0%' },
] as const;

const DOCUMENTS = [
  { ref: 'PR-2026-00007', party: 'Purchase requisition', amount: null, status: 'SUBMITTED' },
  { ref: 'PO-2026-00001', party: 'Luzon Steel Works Inc.', amount: '₱610,482.92', status: 'PARTIALLY_RECEIVED' },
  { ref: 'PO-2026-00002', party: 'Pioneer Cement Trading', amount: '₱559,440.00', status: 'RECEIVED' },
  { ref: 'PO-2026-00005', party: 'BrightWire Electrical Supply', amount: '₱34,608.00', status: 'DRAFT' },
] as const;

const RAIL = [LayoutDashboard, FolderKanban, ShoppingCart, Warehouse, ClipboardCheck, Landmark] as const;

function CostLines() {
  return (
    <div className="rounded-lg border border-border bg-surface p-4 shadow-card">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm font-semibold text-foreground">Budget vs actual</p>
        <p className="text-2xs text-subtle-foreground">By cost code</p>
      </div>
      <ul className="mt-3 space-y-3">
        {COST_LINES.map((line) => (
          <li key={line.code}>
            <div className="flex items-baseline justify-between gap-2 text-xs">
              <span className="min-w-0 truncate text-foreground">
                <span className="doc-id mr-1.5 text-subtle-foreground">{line.code}</span>
                {line.name}
              </span>
              <span className="num shrink-0 text-muted-foreground">{line.budget}</span>
            </div>
            <div className="mt-1.5 flex h-1.5 overflow-hidden rounded-full bg-surface-sunken" aria-hidden>
              <span className={cn('h-full bg-accent', line.actual)} />
              <span className={cn('h-full bg-primary/45', line.committed)} />
            </div>
            <p className="num mt-1 text-2xs text-subtle-foreground">{line.used} used</p>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex gap-4 border-t border-border pt-3 text-2xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-accent" aria-hidden /> Actual
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-primary/45" aria-hidden /> Committed
        </span>
      </div>
    </div>
  );
}

function Documents() {
  return (
    <div className="rounded-lg border border-border bg-surface shadow-card">
      <p className="px-4 pt-4 text-sm font-semibold text-foreground">Procurement</p>
      <ul className="mt-2 divide-y divide-border">
        {DOCUMENTS.map((doc) => (
          <li key={doc.ref} className="px-4 py-2.5 transition-colors hover:bg-surface-muted">
            <div className="flex items-center justify-between gap-2">
              <span className="doc-id text-primary">{doc.ref}</span>
              <StatusBadge status={doc.status} />
            </div>
            <div className="mt-1 flex items-baseline justify-between gap-2 text-xs">
              <span className="min-w-0 truncate text-muted-foreground">{doc.party}</span>
              {doc.amount ? <span className="num shrink-0 font-medium text-foreground">{doc.amount}</span> : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ApprovalCard() {
  return (
    <div className="w-60 rounded-xl border border-border bg-surface-raised p-4 shadow-pop transition-transform duration-300 hover:-translate-y-0.5">
      <p className="eyebrow">Approvals inbox</p>
      <p className="mt-2 doc-id text-primary">PR-2026-00007</p>
      <p className="text-sm font-medium text-foreground">Metro Heights Tower A</p>
      <ol className="mt-3 space-y-2 text-xs">
        <li className="flex items-center gap-2 text-muted-foreground">
          <span className="grid size-5 place-items-center rounded-full bg-success-subtle text-success">
            <Check className="size-3" aria-hidden />
          </span>
          Submitted
        </li>
        <li className="flex items-center gap-2 font-medium text-foreground">
          <span className="grid size-5 place-items-center rounded-full bg-pending-subtle text-pending">
            <Clock className="size-3" aria-hidden />
          </span>
          Project Manager · waiting
        </li>
      </ol>
    </div>
  );
}

function QcCard() {
  return (
    <div className="w-56 rounded-xl border border-border bg-surface-raised p-4 shadow-pop transition-transform duration-300 hover:-translate-y-0.5">
      <div className="flex items-center gap-2">
        <span className="grid size-7 place-items-center rounded-lg bg-danger-subtle text-danger">
          <PackageX className="size-4" aria-hidden />
        </span>
        <div className="leading-tight">
          <p className="doc-id text-primary">GRN-2026-00001</p>
          <p className="text-2xs text-subtle-foreground">Quality control</p>
        </div>
      </div>
      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
        <span className="font-semibold text-foreground">8 rebar rejected</span> as bent. The rest passed and was posted
        to stock.
      </p>
    </div>
  );
}

export function ProductPreview({ className }: { className?: string }) {
  return (
    <figure className={cn('relative', className)}>
      <div
        className="pointer-events-none absolute -inset-x-10 -inset-y-12 -z-10 bg-[radial-gradient(closest-side,hsl(var(--primary)/0.38),transparent)] blur-2xl"
        aria-hidden
      />
      <div
        className="overflow-hidden rounded-xl border border-white/10 bg-background shadow-[0_40px_80px_-24px_rgb(0_0_0/0.6)] ring-1 ring-black/30"
        role="img"
        aria-label="Preview of the Metro Heights Tower A project workspace: budget, committed and actual material cost, budget against actual by cost code, and the status of its purchase requisitions and orders."
      >
        <div className="flex items-center gap-1.5 border-b border-border bg-surface px-4 py-2.5" aria-hidden>
          <span className="size-2.5 rounded-full bg-border-strong" />
          <span className="size-2.5 rounded-full bg-border-strong" />
          <span className="size-2.5 rounded-full bg-border-strong" />
          <span className="ml-3 truncate text-xs text-subtle-foreground">Projects / Metro Heights Tower A</span>
        </div>
        <div className="flex" aria-hidden>
          <div className="hidden w-12 shrink-0 flex-col items-center gap-2 bg-sidebar py-4 sm:flex">
            {RAIL.map((Icon, index) => (
              <span
                key={index}
                className={cn(
                  'grid size-8 place-items-center rounded-md text-sidebar-muted',
                  index === 1 && 'bg-sidebar-active text-sidebar-accent',
                )}
              >
                <Icon className="size-4" strokeWidth={1.75} />
              </span>
            ))}
          </div>
          <div className="min-w-0 flex-1 space-y-3 p-3 sm:space-y-4 sm:p-5">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <p className="doc-id text-subtle-foreground">PRJ-2026-001 · Makati City</p>
                <p className="mt-0.5 text-lg font-semibold tracking-tight text-foreground sm:text-xl">
                  Metro Heights Tower A
                </p>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status="ACTIVE" />
                <span className="num text-xs text-muted-foreground">42% complete</span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              {KPIS.map((kpi) => (
                <div key={kpi.label} className="rounded-lg border border-border bg-surface p-2.5 shadow-card sm:p-3">
                  <p className="eyebrow truncate">{kpi.label}</p>
                  <p
                    className={cn(
                      'num mt-1 text-base font-semibold tracking-tight text-foreground sm:text-2xl',
                      'accent' in kpi && 'text-accent-strong',
                    )}
                  >
                    {kpi.value}
                  </p>
                  <p className="mt-0.5 hidden truncate text-2xs text-subtle-foreground sm:block">{kpi.hint}</p>
                </div>
              ))}
            </div>

            <div className="grid gap-3 sm:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] sm:gap-4">
              <CostLines />
              <Documents />
            </div>
          </div>
        </div>
      </div>

      <div className="absolute -left-10 bottom-16 hidden xl:block" aria-hidden>
        <ApprovalCard />
      </div>
      <div className="absolute -right-6 -top-8 hidden xl:block" aria-hidden>
        <QcCard />
      </div>

      <figcaption className="mt-4 flex items-center justify-center gap-1.5 text-sm text-sidebar-muted">
        <Info className="size-4" aria-hidden />
        Sample data from the ProBuild demo environment
      </figcaption>
    </figure>
  );
}
