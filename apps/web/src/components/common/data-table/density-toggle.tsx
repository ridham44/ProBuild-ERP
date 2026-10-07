'use client';

import { Rows2, Rows3 } from 'lucide-react';
import { IconButton } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';

export type Density = 'compact' | 'comfortable';

export function DensityToggle({
  density,
  onChange,
}: {
  density: Density;
  onChange: (density: Density) => void;
}) {
  const next: Density = density === 'compact' ? 'comfortable' : 'compact';
  return (
    <Tooltip content={`Switch to ${next} rows`}>
      <IconButton
        label={`Row density: ${density}. Switch to ${next}`}
        variant="secondary"
        size="sm"
        onClick={() => onChange(next)}
      >
        {density === 'compact' ? (
          <Rows3 className="size-3.5" aria-hidden />
        ) : (
          <Rows2 className="size-3.5" aria-hidden />
        )}
      </IconButton>
    </Tooltip>
  );
}
