'use client';

import { CheckCircle2, Info, OctagonAlert, X } from 'lucide-react';
import { useSyncExternalStore } from 'react';
import { cn } from '@/lib/utils';

type ToastTone = 'success' | 'error' | 'info';
type ToastItem = { id: number; tone: ToastTone; title: string; description?: string };

let items: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function dismiss(id: number): void {
  items = items.filter((item) => item.id !== id);
  emit();
}

function push(tone: ToastTone, title: string, description?: string): void {
  const id = nextId++;
  items = [...items.slice(-3), { id, tone, title, ...(description ? { description } : {}) }];
  emit();
  setTimeout(() => dismiss(id), tone === 'error' ? 8000 : 4500);
}

/** Imperative toast API usable from any client code, including mutation callbacks. */
export const toast = {
  success: (title: string, description?: string) => push('success', title, description),
  error: (title: string, description?: string) => push('error', title, description),
  info: (title: string, description?: string) => push('info', title, description),
};

const icons = { success: CheckCircle2, error: OctagonAlert, info: Info } as const;
const accents: Record<ToastTone, string> = {
  success: 'text-success',
  error: 'text-danger',
  info: 'text-info',
};
const emptySnapshot: ToastItem[] = [];

export function Toaster() {
  const current = useSyncExternalStore(
    subscribe,
    () => items,
    () => emptySnapshot,
  );
  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 p-4 sm:items-end"
      role="region"
      aria-label="Notifications"
      aria-live="polite"
    >
      {current.map((item) => {
        const Icon = icons[item.tone];
        return (
          <div
            key={item.id}
            className="pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-lg border border-border bg-surface-raised px-3 py-2.5 shadow-pop animate-in fade-in-0 slide-in-from-bottom-2"
            role={item.tone === 'error' ? 'alert' : 'status'}
          >
            <Icon className={cn('mt-0.5 size-4 shrink-0', accents[item.tone])} aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{item.title}</p>
              {item.description ? (
                <p className="mt-0.5 text-sm text-muted-foreground">{item.description}</p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => dismiss(item.id)}
              className="rounded p-0.5 text-muted-foreground hover:bg-surface-muted hover:text-foreground"
              aria-label="Dismiss notification"
            >
              <X className="size-3.5" aria-hidden />
            </button>
          </div>
        );
      })}
    </div>
  );
}
