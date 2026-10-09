import * as React from 'react';
import { cn } from '@/lib/utils';

export type SummaryFact = {
  label: string;
  value: React.ReactNode;
  /** Tabular numerals (money, quantities). */
  numeric?: boolean;
  /** Larger value for the one figure the page is about, such as a document total. */
  emphasis?: boolean;
  hint?: React.ReactNode;
};

/**
 * Key facts for a document or record, shown directly under its page header. Cells grow to fill each row, so
 * there are never empty gaps whatever the number of facts or the screen width.
 */
export function SummaryStrip({ facts, className }: { facts: SummaryFact[]; className?: string }) {
  return (
    <div
      className={cn(
        'mb-6 overflow-hidden rounded-xl border border-border bg-surface shadow-card',
        className,
      )}
    >
      <dl className="-ml-px -mt-px flex flex-wrap">
        {facts.map((fact) => (
          <div
            key={fact.label}
            className="min-w-0 flex-1 basis-40 border-l border-t border-border px-4 py-3"
          >
            <dt className="eyebrow">{fact.label}</dt>
            <dd
              className={cn(
                'mt-1 truncate font-medium text-foreground',
                fact.numeric && 'num',
                fact.emphasis ? 'text-lg font-semibold' : 'text-sm',
              )}
            >
              {fact.value === null || fact.value === undefined || fact.value === ''
                ? '—'
                : fact.value}
            </dd>
            {fact.hint ? (
              <p className="mt-0.5 truncate text-xs text-muted-foreground">{fact.hint}</p>
            ) : null}
          </div>
        ))}
      </dl>
    </div>
  );
}
