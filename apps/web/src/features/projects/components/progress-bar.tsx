import { Meter, type MeterTone } from '@/components/common/meter';
import { isProjectOverdue } from '../model';

/**
 * Bar colour for a project's physical progress. Colour follows status and schedule, never the percentage alone:
 * completed is green, on hold amber, past its finish date red, everything else neutral cobalt.
 */
export function projectProgressTone(project: {
  status: string;
  revisedEndDate: string | null;
  originalEndDate: string | null;
}): MeterTone {
  if (project.status === 'COMPLETED' || project.status === 'CLOSED') return 'success';
  if (isProjectOverdue(project)) return 'danger';
  if (project.status === 'ON_HOLD') return 'warning';
  if (project.status === 'CANCELLED') return 'neutral';
  return 'primary';
}

/** Thin progress bar with its percentage. */
export function ProgressBar({
  value,
  className,
  label = 'Progress',
  tone = 'primary',
}: {
  value: string | number;
  className?: string;
  label?: string;
  tone?: MeterTone;
}) {
  return <Meter value={value} label={label} tone={tone} {...(className ? { className } : {})} />;
}
