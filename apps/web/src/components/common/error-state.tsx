'use client';

import {
  FileQuestion,
  LockKeyhole,
  RefreshCw,
  ServerCrash,
  TimerOff,
  WifiOff,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { errorKind, errorMessage, type ErrorKind } from '@/lib/api/errors';
import { cn } from '@/lib/utils';

export type ErrorStateKind =
  | 'forbidden'
  | 'not-found'
  | 'server'
  | 'session-expired'
  | 'network'
  | 'generic';

const COPY: Record<ErrorStateKind, { title: string; description: string; icon: LucideIcon }> = {
  forbidden: {
    title: 'You do not have access to this',
    description:
      'Your role does not include this area. If you think it should, ask an administrator to review your permissions.',
    icon: LockKeyhole,
  },
  'not-found': {
    title: 'We could not find that',
    description: 'It may have been removed, or the link may be wrong.',
    icon: FileQuestion,
  },
  server: {
    title: 'The server hit a problem',
    description: 'This is on our side, not yours. Try again in a moment.',
    icon: ServerCrash,
  },
  'session-expired': {
    title: 'Your session has ended',
    description:
      'For your security you were signed out. Sign in again to continue where you left off.',
    icon: TimerOff,
  },
  network: {
    title: 'Cannot reach the server',
    description: 'Check your connection and try again.',
    icon: WifiOff,
  },
  generic: {
    title: 'Something went wrong',
    description: 'Please try again. If it keeps happening, contact your administrator.',
    icon: ServerCrash,
  },
};

export type ErrorStateProps = {
  kind?: ErrorStateKind;
  title?: string;
  description?: React.ReactNode;
  onRetry?: () => void;
  retrying?: boolean;
  action?: React.ReactNode;
  className?: string;
  compact?: boolean;
};

export function ErrorState({
  kind = 'generic',
  title,
  description,
  onRetry,
  retrying,
  action,
  className,
  compact = false,
}: ErrorStateProps) {
  const copy = COPY[kind];
  const Icon = copy.icon;
  const tone =
    kind === 'forbidden' || kind === 'not-found' || kind === 'session-expired'
      ? 'text-muted-foreground'
      : 'text-danger';
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center text-center',
        compact ? 'gap-1.5 px-4 py-8' : 'gap-2 px-6 py-14',
        className,
      )}
    >
      <span
        className={cn(
          'flex size-9 items-center justify-center rounded-lg border border-border bg-surface-muted',
          tone,
        )}
      >
        <Icon className="size-[18px]" aria-hidden />
      </span>
      <h3 className="mt-1 text-base font-semibold">{title ?? copy.title}</h3>
      <p className="max-w-md text-sm text-muted-foreground">{description ?? copy.description}</p>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
        {kind === 'session-expired' ? (
          <Button asChild variant="primary">
            <Link href="/login">Sign in</Link>
          </Button>
        ) : null}
        {onRetry ? (
          <Button onClick={onRetry} loading={retrying}>
            {retrying ? null : <RefreshCw className="size-3.5" aria-hidden />}
            Try again
          </Button>
        ) : null}
        {action}
      </div>
    </div>
  );
}

const KIND_MAP: Record<ErrorKind, ErrorStateKind> = {
  unauthorized: 'session-expired',
  forbidden: 'forbidden',
  'not-found': 'not-found',
  conflict: 'generic',
  validation: 'generic',
  'rate-limited': 'generic',
  server: 'server',
  network: 'network',
};

/** Picks the right variant for a failed query. Server detail is shown only for client-side (4xx) errors. */
export function QueryErrorState({
  error,
  onRetry,
  retrying,
  className,
  compact,
}: {
  error: unknown;
  onRetry?: () => void;
  retrying?: boolean;
  className?: string;
  compact?: boolean;
}) {
  const kind = errorKind(error);
  const mapped = KIND_MAP[kind];
  const showDetail = mapped === 'generic';
  return (
    <ErrorState
      kind={mapped}
      {...(showDetail ? { description: errorMessage(error) } : {})}
      {...(onRetry ? { onRetry } : {})}
      {...(retrying !== undefined ? { retrying } : {})}
      {...(className ? { className } : {})}
      {...(compact !== undefined ? { compact } : {})}
    />
  );
}
