import { cn } from '@/lib/utils';

const BARS = [
  'h-[38%]',
  'h-[52%]',
  'h-[44%]',
  'h-[68%]',
  'h-[59%]',
  'h-[82%]',
  'h-[74%]',
] as const;

const KPIS = [
  { label: 'Budget', value: '₱3.50M', accent: false },
  { label: 'Committed', value: '₱0.58M', accent: false },
  { label: 'Material actual', value: '₱0.31M', accent: true },
] as const;

const ROWS = [
  { ref: 'PO-0042', name: 'Portland cement 40kg', status: 'Received', tone: 'bg-emerald-400' },
  { ref: 'GRN-0017', name: 'Rebar 16mm, lot B', status: 'In QC', tone: 'bg-amber-300' },
  { ref: 'MI-0009', name: 'Issued to Tower A', status: 'Posted', tone: 'bg-sidebar-accent' },
] as const;

/** Illustrative mock of the app, built in markup so it stays sharp at any size and follows the brand colours. */
export function ProductPreview({ className }: { className?: string }) {
  return (
    <div className={cn('relative', className)}>
      <div className="absolute -inset-6 rounded-[2rem] bg-primary/30 blur-3xl" aria-hidden />
      <div className="relative overflow-hidden rounded-2xl border border-white/15 bg-sidebar shadow-2xl ring-1 ring-black/40">
        <div className="flex items-center gap-1.5 border-b border-white/10 px-4 py-2.5">
          <span className="size-2.5 rounded-full bg-white/20" />
          <span className="size-2.5 rounded-full bg-white/20" />
          <span className="size-2.5 rounded-full bg-white/20" />
          <span className="ml-3 text-xs text-sidebar-muted">Tower A · Project workspace</span>
        </div>
        <div className="space-y-4 p-4 sm:p-5">
          <div className="grid grid-cols-3 gap-3">
            {KPIS.map((kpi) => (
              <div key={kpi.label} className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
                <p className="text-2xs font-medium uppercase tracking-wider text-sidebar-muted">{kpi.label}</p>
                <p
                  className={cn(
                    'mt-1 text-lg font-semibold tabular-nums text-white sm:text-xl',
                    kpi.accent && 'text-sidebar-accent',
                  )}
                >
                  {kpi.value}
                </p>
              </div>
            ))}
          </div>

          <div className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
            <div className="flex items-center justify-between text-xs text-sidebar-muted">
              <span>Material cost by week</span>
              <span className="text-sidebar-accent">Net of returns</span>
            </div>
            <div className="mt-3 flex h-24 items-end gap-2" aria-hidden>
              {BARS.map((height, index) => (
                <div
                  key={height}
                  className={cn(
                    'flex-1 rounded-t bg-gradient-to-t from-primary/50 to-sidebar-accent',
                    height,
                    index === BARS.length - 1 && 'ring-1 ring-white/40',
                  )}
                />
              ))}
            </div>
          </div>

          <ul className="divide-y divide-white/10 rounded-lg border border-white/10 bg-white/[0.04] text-sm">
            {ROWS.map((row) => (
              <li key={row.ref} className="flex items-center gap-3 px-3 py-2.5">
                <span className="font-mono text-xs text-sidebar-muted">{row.ref}</span>
                <span className="min-w-0 flex-1 truncate text-white/90">{row.name}</span>
                <span className="inline-flex items-center gap-1.5 text-xs text-white/80">
                  <span className={cn('size-1.5 rounded-full', row.tone)} aria-hidden />
                  {row.status}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <p className="mt-3 text-center text-xs text-sidebar-muted">Illustrative sample data</p>
    </div>
  );
}
