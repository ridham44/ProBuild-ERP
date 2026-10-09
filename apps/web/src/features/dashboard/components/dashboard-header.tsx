'use client';

import { ClipboardList, Plus, Scale } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useCan, useCurrentUser } from '@/features/auth/components/current-user';
import { greeting, todayLabel } from '../model';

/** Greeting, today's date and the actions this user's role can take straight away. */
export function DashboardHeader() {
  const user = useCurrentUser();
  const canRaisePr = useCan('procurement.requisition', 'CREATE');
  const canApprove = useCan('approvals.inbox', 'VIEW');
  const firstName = user.name.split(' ')[0] ?? user.name;
  return (
    <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <p className="eyebrow">{todayLabel()}</p>
        <h1 className="mt-1.5 text-3xl font-semibold text-foreground">
          {greeting()}, {firstName}
        </h1>
        {user.roles.length > 0 ? (
          <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
            Signed in as
            {user.roles.map((role) => (
              <span
                key={role}
                className="rounded-full border border-border bg-surface px-2 py-0.5 text-xs font-medium text-foreground"
              >
                {role}
              </span>
            ))}
          </p>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {canApprove ? (
          <Button asChild>
            <Link href="/approvals">
              <Scale className="size-3.5" aria-hidden />
              Approvals
            </Link>
          </Button>
        ) : null}
        {canRaisePr ? (
          <Button asChild variant="primary">
            <Link href="/procurement/requests/new">
              <Plus className="size-3.5" aria-hidden />
              New requisition
            </Link>
          </Button>
        ) : (
          <Button asChild variant="ghost">
            <Link href="/procurement/requests">
              <ClipboardList className="size-3.5" aria-hidden />
              Requisitions
            </Link>
          </Button>
        )}
      </div>
    </header>
  );
}
