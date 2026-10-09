import { Skeleton } from '@/components/ui/skeleton';

/** Placeholder shaped like a detail page: header, key facts, tabs and a panel. */
export function DetailPageSkeleton({ label }: { label: string }) {
  return (
    <div className="space-y-6" role="status" aria-label={label}>
      <div className="space-y-3">
        <Skeleton className="h-3 w-40" />
        <div className="flex items-center gap-3.5">
          <Skeleton className="size-10 rounded-xl" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-64" />
            <Skeleton className="h-3.5 w-80 max-w-full" />
          </div>
        </div>
      </div>
      <Skeleton className="h-[4.5rem] w-full rounded-xl" />
      <div className="flex gap-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-4 w-20" />
        ))}
      </div>
      <Skeleton className="h-72 w-full rounded-xl" />
    </div>
  );
}

/** Placeholder shaped like a list page: header, toolbar and table. */
export function ListPageSkeleton({ label }: { label: string }) {
  return (
    <div className="space-y-6" role="status" aria-label={label}>
      <div className="flex items-center gap-3.5">
        <Skeleton className="size-10 rounded-xl" />
        <div className="space-y-2">
          <Skeleton className="h-6 w-56" />
          <Skeleton className="h-3.5 w-80 max-w-full" />
        </div>
      </div>
      <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-card">
        <div className="flex gap-2 border-b border-border px-4 py-2.5">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-8 w-40" />
        </div>
        <div className="space-y-3 p-4">
          {Array.from({ length: 8 }, (_, index) => (
            <Skeleton key={index} className="h-4 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
