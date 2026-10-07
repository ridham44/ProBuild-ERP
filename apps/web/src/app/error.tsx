'use client';

import { ErrorState } from '@/components/common/error-state';

export default function RootError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <ErrorState kind="generic" onRetry={reset} />
    </div>
  );
}
