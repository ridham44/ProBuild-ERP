import Image from 'next/image';
import { cn } from '@/lib/utils';

/** The official ProBuild emblem. The artwork has a white background, so it sits on a white tile in any theme. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <Image
      src="/logo-mark.png"
      alt="ProBuild"
      width={400}
      height={297}
      priority
      className={cn('size-6 rounded-md bg-white object-contain', className)}
    />
  );
}
