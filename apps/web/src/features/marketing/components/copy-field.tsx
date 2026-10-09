'use client';

import { Check, Copy } from 'lucide-react';
import * as React from 'react';
import { cn } from '@/lib/utils';

/** A read-only value with a copy button, for the demo credentials. */
export function CopyField({ label, value }: { label: string; value: string }) {
  const [state, setState] = React.useState<'idle' | 'copied' | 'failed'>('idle');
  const timer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  React.useEffect(() => () => clearTimeout(timer.current), []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setState('copied');
    } catch {
      setState('failed');
    }
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setState('idle'), 2000);
  };

  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wider text-sidebar-muted">{label}</p>
      <div className="mt-1.5 flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 py-1.5 pl-3.5 pr-1.5">
        <code className="min-w-0 flex-1 select-all truncate font-mono text-base text-white">{value}</code>
        <button
          type="button"
          onClick={() => void copy()}
          className={cn(
            'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-sm font-medium transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-accent',
            state === 'copied' ? 'bg-sidebar-accent text-sidebar' : 'bg-white/10 text-white hover:bg-white/20',
          )}
          aria-label={`Copy ${label.toLowerCase()}`}
        >
          {state === 'copied' ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
          {state === 'copied' ? 'Copied' : state === 'failed' ? 'Select & copy' : 'Copy'}
        </button>
      </div>
      <span className="sr-only" aria-live="polite">
        {state === 'copied' ? `${label} copied` : ''}
      </span>
    </div>
  );
}
