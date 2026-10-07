import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';

export function SortIndicator({ direction }: { direction: false | 'asc' | 'desc' }) {
  if (direction === 'asc') return <ArrowUp className="size-3 text-foreground" aria-hidden />;
  if (direction === 'desc') return <ArrowDown className="size-3 text-foreground" aria-hidden />;
  return <ChevronsUpDown className="size-3 opacity-50" aria-hidden />;
}
