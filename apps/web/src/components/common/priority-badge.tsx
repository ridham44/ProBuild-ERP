import { ArrowDown, ArrowUp, Flame } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { titleCase } from '@/lib/format';

/**
 * Restrained priority marker: only Urgent gets a filled pill, High is coloured text, Normal and Low stay quiet so
 * a long list does not turn into a wall of colour.
 */
export function PriorityBadge({ priority }: { priority: string }) {
  if (priority === 'URGENT') {
    return (
      <Badge tone="danger">
        <Flame className="size-3" aria-hidden />
        Urgent
      </Badge>
    );
  }
  if (priority === 'HIGH') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-warning">
        <ArrowUp className="size-3" strokeWidth={2.5} aria-hidden />
        High
      </span>
    );
  }
  if (priority === 'LOW') {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-subtle-foreground">
        <ArrowDown className="size-3" aria-hidden />
        Low
      </span>
    );
  }
  return <span className="text-xs text-muted-foreground">{titleCase(priority)}</span>;
}
