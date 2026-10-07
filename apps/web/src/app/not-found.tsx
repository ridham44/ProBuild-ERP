import Link from 'next/link';
import { ErrorState } from '@/components/common/error-state';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <ErrorState
        kind="not-found"
        title="This page does not exist"
        description="The address may be mistyped, or the page may have moved."
        action={
          <Button asChild variant="primary">
            <Link href="/">Go to dashboard</Link>
          </Button>
        }
      />
    </div>
  );
}
