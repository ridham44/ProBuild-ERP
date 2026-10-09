import { BrandMark } from '@/components/common/brand-mark';

const MODULES = ['Projects', 'Procurement', 'Inventory', 'Finance'];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh bg-background lg:grid-cols-[minmax(0,28rem)_1fr]">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-sidebar p-10 text-sidebar-foreground lg:flex">
        <div className="blueprint-grid pointer-events-none absolute inset-0" aria-hidden />
        <div className="relative flex items-center gap-3">
          <BrandMark className="size-9 rounded-lg p-0.5" />
          <div className="leading-none">
            <p className="text-lg font-semibold tracking-tight text-white">ProBuild</p>
            <p className="mt-1 text-2xs text-sidebar-muted">Construction ERP</p>
          </div>
        </div>
        <div className="relative space-y-5">
          <span className="block h-1 w-10 rounded-full bg-sidebar-accent" aria-hidden />
          <p className="text-3xl font-semibold leading-tight tracking-tight text-white">
            One ledger from the first purchase request to the final billing.
          </p>
          <p className="text-sm leading-relaxed text-sidebar-foreground">
            Project cost, procurement, inventory and finance for contractors, with approvals and an
            audit trail on every document.
          </p>
          <ul className="flex flex-wrap gap-2" aria-label="Modules">
            {MODULES.map((module) => (
              <li
                key={module}
                className="rounded-full border border-sidebar-border bg-sidebar-hover px-3 py-1 text-xs font-medium text-sidebar-foreground"
              >
                {module}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-sidebar-muted">Asia/Manila · PHP</p>
      </aside>
      <main className="flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-6 shadow-card sm:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
