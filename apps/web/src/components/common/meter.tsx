import * as React from 'react';
import { cn } from '@/lib/utils';

export type MeterTone =
  | 'primary'
  | 'accent'
  | 'success'
  | 'warning'
  | 'danger'
  | 'violet'
  | 'pending'
  | 'neutral';

const FILL: Record<MeterTone, string> = {
  primary: 'bg-primary',
  accent: 'bg-accent',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  violet: 'bg-violet',
  pending: 'bg-pending',
  neutral: 'bg-border-strong',
};

export function meterFillClass(tone: MeterTone): string {
  return FILL[tone];
}

function clampPercent(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;
}

/** Single horizontal bar for a 0–100 value. The fill width is the only genuinely dynamic style. */
export function Meter({
  value,
  label,
  tone = 'primary',
  showValue = true,
  valueText,
  size = 'sm',
  className,
}: {
  value: number | string;
  /** Accessible name. */
  label: string;
  tone?: MeterTone;
  showValue?: boolean;
  /** Text beside the bar; defaults to the rounded percentage. */
  valueText?: React.ReactNode;
  size?: 'sm' | 'md';
  className?: string;
}) {
  const percent = clampPercent(Number(value));
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(percent)}
        className={cn(
          'flex-1 overflow-hidden rounded-full bg-surface-sunken',
          size === 'md' ? 'h-2' : 'h-1.5',
        )}
      >
        <div
          className={cn('h-full rounded-full transition-[width] duration-500', FILL[tone])}
          style={{ width: `${percent}%` }}
        />
      </div>
      {showValue ? (
        <span className="num w-10 shrink-0 text-right text-xs font-medium text-muted-foreground">
          {valueText ?? `${percent.toFixed(0)}%`}
        </span>
      ) : null}
    </div>
  );
}

export type StackedSegment = { label: string; value: number; tone: MeterTone };

/**
 * Parts of one whole (accepted / rejected / quarantined, issued / remaining). Segments are sized against `total`
 * when given, so an unfinished whole shows its empty remainder.
 */
export function StackedBar({
  segments,
  total,
  label,
  legend = false,
  formatValue = (value) => value.toLocaleString('en-PH'),
  className,
}: {
  segments: StackedSegment[];
  total?: number;
  label: string;
  legend?: boolean;
  formatValue?: (value: number) => string;
  className?: string;
}) {
  const sum = segments.reduce((acc, segment) => acc + Math.max(0, segment.value), 0);
  const whole = Math.max(total ?? sum, sum);
  const visible = segments.filter((segment) => segment.value > 0);
  const description = segments
    .map((segment) => `${segment.label} ${formatValue(segment.value)}`)
    .join(', ');
  return (
    <div className={cn('space-y-2', className)}>
      <div
        role="img"
        aria-label={`${label}: ${description}`}
        className="flex h-2 gap-px overflow-hidden rounded-full bg-surface-sunken"
      >
        {whole > 0
          ? visible.map((segment) => (
              <div
                key={segment.label}
                className={cn('h-full first:rounded-l-full last:rounded-r-full', FILL[segment.tone])}
                style={{ width: `${(segment.value / whole) * 100}%` }}
              />
            ))
          : null}
      </div>
      {legend ? (
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs" aria-hidden>
          {segments.map((segment) => (
            <li key={segment.label} className="flex items-center gap-1.5 text-muted-foreground">
              <span className={cn('size-2 rounded-full', FILL[segment.tone])} />
              {segment.label}
              <span className="num font-medium text-foreground">{formatValue(segment.value)}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
