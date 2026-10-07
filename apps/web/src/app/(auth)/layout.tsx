import { BrandMark } from '@/components/common/brand-mark';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,26rem)_1fr]">
      <aside className="hidden flex-col justify-between bg-sidebar p-8 text-sidebar-foreground lg:flex">
        <div className="flex items-center gap-2.5">
          <BrandMark className="size-7" />
          <span className="text-lg font-semibold tracking-tight text-white">ProBuild</span>
        </div>
        <div className="space-y-3">
          <p className="text-2xl font-semibold leading-snug tracking-tight text-white">
            One ledger from the first purchase request to the final billing.
          </p>
          <p className="text-sm text-sidebar-muted">
            Project cost, procurement, inventory and finance for contractors, with approvals and an
            audit trail on every document.
          </p>
        </div>
        <p className="text-xs text-sidebar-muted">Asia/Manila · PHP</p>
      </aside>
      <main className="flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm">{children}</div>
      </main>
    </div>
  );
}
