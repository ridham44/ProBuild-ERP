import {
  ArrowRight,
  BadgeCheck,
  ClipboardCheck,
  Clock,
  Database,
  FolderKanban,
  Landmark,
  PackageCheck,
  Repeat,
  ShieldCheck,
  ShoppingCart,
  Warehouse,
} from 'lucide-react';
import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { BrandMark } from '@/components/common/brand-mark';
import { cn } from '@/lib/utils';
import { DEMO_ACCOUNT, DEMO_STEPS, WORKFLOW_STEPS } from '../demo';
import { CopyField } from './copy-field';
import { ProductPreview } from './product-preview';

type Cta = { href: string; label: string };

const primaryButton =
  'inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-sidebar-accent px-5 text-base font-semibold text-sidebar shadow-lg shadow-sidebar-accent/20 transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar';
const ghostButton =
  'inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-white/20 px-5 text-base font-medium text-white transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar';

const MODULES: Array<{ icon: LucideIcon; title: string; body: string }> = [
  {
    icon: FolderKanban,
    title: 'Projects, WBS and BOQ',
    body: 'Contracts, work breakdown, estimates and an approved control budget that every purchase is measured against.',
  },
  {
    icon: ShoppingCart,
    title: 'Procurement',
    body: 'Requisition to RFQ, quotation comparison, split awards and approved purchase orders with amount-band routing.',
  },
  {
    icon: PackageCheck,
    title: 'Receiving and QC',
    body: 'Partial deliveries, per-line inspection, quarantine and release, and a hard stop on over-receipt without an override.',
  },
  {
    icon: Warehouse,
    title: 'Inventory and material control',
    body: 'Stock by warehouse, batch and status, material requests, issues and returns, all posted to an append-only ledger.',
  },
  {
    icon: ClipboardCheck,
    title: 'Approvals and audit',
    body: 'Configurable approval workflows and an audit trail with the actor, reason and before-and-after on every document.',
  },
  {
    icon: Landmark,
    title: 'Accounting foundation',
    body: 'Chart of accounts, open and closed periods, manual journals, reversals, trial balance and general ledger.',
  },
];

const TRUST: Array<{ icon: LucideIcon; title: string; body: string }> = [
  { icon: Database, title: 'Append-only ledgers', body: 'Stock, cost, journal and audit rows can never be edited.' },
  { icon: ShieldCheck, title: 'Tenant isolation', body: 'Enforced in services and again by database triggers.' },
  { icon: Repeat, title: 'Safe retries', body: 'Idempotency keys on every posting action.' },
  { icon: Clock, title: 'Philippine time and PHP', body: 'Dates, periods and currency set for local books.' },
];

const COMING = ['Accounts payable', 'Billing and retention', 'Payroll', 'Equipment', 'Subcontractors'] as const;

export function HomeNav({ signedIn }: { signedIn: boolean }) {
  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-sidebar/95 backdrop-blur-lg">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 sm:px-6">
        <Link href="/home" className="flex items-center gap-2.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-accent">
          <BrandMark className="size-8" />
          <span className="text-lg font-semibold tracking-tight text-white">
            ProBuild <span className="font-normal text-sidebar-muted">ERP</span>
          </span>
        </Link>
        <nav aria-label="Sections" className="ml-4 hidden items-center gap-1 text-sm md:flex">
          {[
            ['#modules', 'Modules'],
            ['#workflow', 'Workflow'],
            ['#demo', 'Live demo'],
          ].map(([href, label]) => (
            <a key={href} href={href} className="rounded-md px-3 py-2 text-sidebar-foreground transition hover:bg-white/10 hover:text-white">
              {label}
            </a>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <Link
            href={signedIn ? '/' : '/login'}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-white px-4 text-sm font-semibold text-sidebar transition hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-accent"
          >
            {signedIn ? 'Open dashboard' : 'Sign in'}
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
      </div>
    </header>
  );
}

export function HomeHero({ primary, secondary }: { primary: Cta; secondary: Cta }) {
  return (
    <section className="relative isolate overflow-hidden bg-sidebar text-sidebar-foreground">
      <div
        className="absolute inset-0 -z-10 [background-image:linear-gradient(hsl(0_0%_100%/0.04)_1px,transparent_1px),linear-gradient(90deg,hsl(0_0%_100%/0.04)_1px,transparent_1px)] [background-size:56px_56px] [mask-image:radial-gradient(ellipse_70%_60%_at_50%_0%,black,transparent)]"
        aria-hidden
      />
      <div
        className="absolute inset-0 -z-10 bg-[radial-gradient(60%_50%_at_85%_10%,hsl(var(--primary)/0.45),transparent),radial-gradient(40%_40%_at_10%_90%,hsl(var(--sidebar-accent)/0.18),transparent)]"
        aria-hidden
      />
      <div className="mx-auto grid max-w-7xl items-center gap-14 px-4 pb-20 pt-16 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:pb-28 lg:pt-24">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-white/90">
            <BadgeCheck className="size-3.5 text-sidebar-accent" aria-hidden />
            Plan · Manage · Build · Grow
          </p>
          <h1 className="mt-6 text-4xl font-semibold leading-[1.08] tracking-tight text-white sm:text-5xl lg:text-6xl">
            One ledger from the first purchase request to the{' '}
            <span className="bg-gradient-to-r from-white to-sidebar-accent bg-clip-text text-transparent">
              final billing.
            </span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-sidebar-foreground">
            ProBuild ERP gives contractors project cost, procurement, inventory and finance in one place, with
            approvals and an audit trail on every document, and a real cost against every peso spent.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link href={primary.href} className={primaryButton}>
              {primary.label}
              <ArrowRight className="size-4" aria-hidden />
            </Link>
            <Link href={secondary.href} className={ghostButton}>
              {secondary.label}
            </Link>
          </div>
        </div>
        <ProductPreview className="mx-auto w-full max-w-xl" />
      </div>
    </section>
  );
}

export function TrustStrip() {
  return (
    <section aria-label="Built for audit" className="border-b border-border bg-surface">
      <ul className="mx-auto grid max-w-7xl gap-px bg-border sm:grid-cols-2 lg:grid-cols-4">
        {TRUST.map(({ icon: Icon, title, body }) => (
          <li key={title} className="flex items-start gap-3 bg-surface px-6 py-6">
            <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg bg-primary-subtle text-primary">
              <Icon className="size-5" aria-hidden />
            </span>
            <div>
              <p className="text-base font-semibold">{title}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">{body}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function SectionHeading({ eyebrow, title, body }: { eyebrow: string; title: string; body: string }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <p className="text-sm font-semibold uppercase tracking-widest text-primary">{eyebrow}</p>
      <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h2>
      <p className="mt-4 text-lg text-muted-foreground">{body}</p>
    </div>
  );
}

export function ModulesSection() {
  return (
    <section id="modules" className="scroll-mt-20 bg-background py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <SectionHeading
          eyebrow="Modules"
          title="Everything a project needs to buy, receive and account for material"
          body="Each module posts to the same ledgers, so what the site team does is what the finance team sees."
        />
        <ul className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {MODULES.map(({ icon: Icon, title, body }) => (
            <li
              key={title}
              className="group rounded-2xl border border-border bg-surface p-6 shadow-xs transition hover:-translate-y-0.5 hover:border-primary-border hover:shadow-pop"
            >
              <span className="grid size-11 place-items-center rounded-xl bg-gradient-to-br from-primary to-sidebar-accent text-primary-foreground shadow-sm">
                <Icon className="size-5" aria-hidden />
              </span>
              <h3 className="mt-5 text-lg font-semibold">{title}</h3>
              <p className="mt-2 text-base leading-relaxed text-muted-foreground">{body}</p>
            </li>
          ))}
        </ul>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-2 text-sm">
          <span className="font-medium text-muted-foreground">On the roadmap:</span>
          {COMING.map((name) => (
            <span key={name} className="rounded-full border border-dashed border-border-strong px-3 py-1 text-muted-foreground">
              {name}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

export function WorkflowSection() {
  return (
    <section id="workflow" className="scroll-mt-20 border-y border-border bg-surface-muted py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <SectionHeading
          eyebrow="Procure to cost"
          title="From a site request to a cost on the project"
          body="Eight steps, each one approved, audited and tied to the WBS, cost code and BOQ line it belongs to."
        />
        <ol className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {WORKFLOW_STEPS.map((step, index) => (
            <li key={step.label} className="relative rounded-2xl border border-border bg-surface p-5 shadow-xs">
              <span className="font-mono text-sm font-medium text-primary">{String(index + 1).padStart(2, '0')}</span>
              <p className="mt-2 text-lg font-semibold">{step.label}</p>
              <p className="mt-1 text-sm text-muted-foreground">{step.detail}</p>
              {index < WORKFLOW_STEPS.length - 1 ? (
                <ArrowRight
                  className={cn(
                    'absolute -right-3 top-1/2 hidden size-5 -translate-y-1/2 rounded-full bg-surface-muted text-primary',
                    (index + 1) % 4 !== 0 && 'lg:block',
                  )}
                  aria-hidden
                />
              ) : null}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export function DemoSection({ signedIn }: { signedIn: boolean }) {
  return (
    <section id="demo" className="scroll-mt-20 bg-background py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="relative isolate overflow-hidden rounded-3xl bg-sidebar px-6 py-12 text-sidebar-foreground shadow-pop sm:px-12 sm:py-16">
          <div
            className="absolute inset-0 -z-10 bg-[radial-gradient(50%_60%_at_100%_0%,hsl(var(--primary)/0.5),transparent),radial-gradient(40%_50%_at_0%_100%,hsl(var(--sidebar-accent)/0.2),transparent)]"
            aria-hidden
          />
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <p className="text-sm font-semibold uppercase tracking-widest text-sidebar-accent">Live demo</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                Try it yourself. No sign-up.
              </h2>
              <p className="mt-4 text-lg text-sidebar-foreground">
                Sign in with the demo administrator account and walk the whole procure-to-cost flow.
              </p>
              <ol className="mt-8 space-y-3">
                {DEMO_STEPS.map((step, index) => (
                  <li key={step} className="flex items-start gap-3 text-base">
                    <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-white/10 text-xs font-semibold text-white">
                      {index + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>

            <div className={cn('rounded-2xl border border-white/15 bg-white/[0.06] p-6 backdrop-blur sm:p-8')}>
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white">Demo credentials</h3>
                <span className="rounded-full bg-sidebar-accent/15 px-2.5 py-1 text-xs font-medium text-sidebar-accent">
                  Administrator
                </span>
              </div>
              <div className="mt-6 space-y-5">
                <CopyField label="ID" value={DEMO_ACCOUNT.email} />
                <CopyField label="Password" value={DEMO_ACCOUNT.password} />
              </div>
              <Link href={signedIn ? '/' : '/login'} className={cn(primaryButton, 'mt-7 w-full')}>
                {signedIn ? 'Open dashboard' : 'Continue to sign in'}
                <ArrowRight className="size-4" aria-hidden />
              </Link>
              <p className="mt-4 text-xs leading-relaxed text-sidebar-muted">
                Shared demo account on a demo database. Do not enter real company data; it may be reset at any time.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function HomeFooter() {
  return (
    <footer className="border-t border-border bg-surface">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:px-6">
        <div className="flex items-center gap-2.5">
          <BrandMark className="size-6" />
          <span>ProBuild ERP · Plan · Manage · Build · Grow</span>
        </div>
        <p>Asia/Manila · PHP</p>
      </div>
    </footer>
  );
}
