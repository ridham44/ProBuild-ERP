import { cn } from '@/lib/utils';

/** Thin horizontal progress bar with its percentage; the bar width is a genuinely dynamic value. */
export function ProgressBar({
  value,
  className,
  label = 'Progress',
}: {
  value: string | number;
  className?: string;
  label?: string;
}) {
  const percent = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(percent)}
        className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-muted"
      >
        <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
      </div>
      <span className="num w-10 text-right text-xs text-muted-foreground">{percent.toFixed(0)}%</span>
    </div>
  );
}
