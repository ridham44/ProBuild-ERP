import {
  PROJECT_STATUSES,
  PROJECT_TRANSITIONS,
  PROJECT_TYPES,
  type ProjectStatusKey,
} from '@probuild/shared';
import { isBeforeManilaToday, titleCase } from '@/lib/format';

export const PROJECT_TYPE_OPTIONS = PROJECT_TYPES.map((value) => ({ value, label: titleCase(value) }));
export const PROJECT_STATUS_OPTIONS = PROJECT_STATUSES.map((value) => ({ value, label: titleCase(value) }));

type TransitionCopy = { label: string; title: string; description: string; danger?: boolean; reasonRequired: boolean };

const COPY: Record<ProjectStatusKey, TransitionCopy> = {
  PIPELINE: {
    label: 'Move to pipeline',
    title: 'Move back to pipeline?',
    description: 'The project returns to the tender stage.',
    reasonRequired: false,
  },
  ACTIVE: {
    label: 'Activate',
    title: 'Activate this project?',
    description:
      'An active project can raise purchase requisitions and receive materials. Notice to proceed is assumed.',
    reasonRequired: false,
  },
  ON_HOLD: {
    label: 'Put on hold',
    title: 'Put this project on hold?',
    description: 'Work pauses. Record why so the team and the client have the same story.',
    reasonRequired: true,
  },
  COMPLETED: {
    label: 'Mark completed',
    title: 'Mark this project completed?',
    description: 'Construction is finished. Closing and final accounts follow.',
    reasonRequired: false,
  },
  CLOSED: {
    label: 'Close project',
    title: 'Close this project?',
    description: 'Closing is final. No further documents can be raised against the project.',
    danger: true,
    reasonRequired: true,
  },
  CANCELLED: {
    label: 'Cancel project',
    title: 'Cancel this project?',
    description: 'Cancelling is final. Existing documents stay on record but nothing new can be raised.',
    danger: true,
    reasonRequired: true,
  },
};

export function transitionCopy(target: ProjectStatusKey): TransitionCopy {
  return COPY[target];
}

/** Moves the workflow allows from the project's current status. */
export function allowedTransitions(status: ProjectStatusKey): readonly ProjectStatusKey[] {
  return PROJECT_TRANSITIONS[status];
}

/** Share of a total as a 0-100 number for bars; never above 100 and 0 when the total is empty. */
export function shareOf(value: string | number | null | undefined, total: string | number): number {
  const numerator = Number(value ?? 0);
  const denominator = Number(total);
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) return 0;
  return Math.max(0, Math.min(100, (numerator / denominator) * 100));
}

/** Statuses that mean the job is finished or abandoned, so a passed finish date is no longer a risk. */
const PROJECT_DONE_STATUSES: ReadonlySet<string> = new Set(['COMPLETED', 'CLOSED', 'CANCELLED']);

/** The finish date currently in force: the revised date when the schedule has been re-baselined. */
export function projectTargetFinish(project: {
  revisedEndDate: string | null;
  originalEndDate: string | null;
}): string | null {
  return project.revisedEndDate ?? project.originalEndDate;
}

/** Overdue means the target finish has passed while the project is still open; low progress alone never is. */
export function isProjectOverdue(
  project: { status: string; revisedEndDate: string | null; originalEndDate: string | null },
  now: Date = new Date(),
): boolean {
  if (PROJECT_DONE_STATUSES.has(project.status)) return false;
  return isBeforeManilaToday(projectTargetFinish(project), now);
}
