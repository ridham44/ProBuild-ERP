import {
  Bell,
  ClipboardCheck,
  Clock,
  PackageCheck,
  PackageMinus,
  Scale,
  ShieldAlert,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { formatDate, manilaToday } from '@/lib/format';

export type NotificationLook = { icon: LucideIcon; className: string };

/** Icon and tint per notification type the API emits. Unknown types fall back to a neutral bell. */
const LOOKS: Record<string, NotificationLook> = {
  APPROVAL_PENDING: { icon: Clock, className: 'bg-pending-subtle text-pending' },
  APPROVAL_RESULT: { icon: Scale, className: 'bg-primary-subtle text-primary' },
  PR_APPROVED: { icon: ClipboardCheck, className: 'bg-approved-subtle text-approved' },
  MR_APPROVED: { icon: ClipboardCheck, className: 'bg-approved-subtle text-approved' },
  MATERIAL_ISSUED: { icon: PackageMinus, className: 'bg-accent-subtle text-accent-strong' },
  MATERIAL_ISSUED_DIRECT: { icon: PackageMinus, className: 'bg-accent-subtle text-accent-strong' },
  GRN_POSTED: { icon: PackageCheck, className: 'bg-success-subtle text-success' },
  GRN_QUARANTINE: { icon: ShieldAlert, className: 'bg-warning-subtle text-warning' },
  ASSET: { icon: Wrench, className: 'bg-violet-subtle text-violet' },
};

const FALLBACK: NotificationLook = { icon: Bell, className: 'bg-surface-muted text-muted-foreground' };

export function notificationLook(type: string): NotificationLook {
  return LOOKS[type] ?? FALLBACK;
}

/** "Today", "Yesterday" or the Manila calendar date, for grouping a feed by day. */
export function notificationDayLabel(iso: string, now: Date = new Date()): string {
  const target = manilaToday(new Date(iso));
  if (target === manilaToday(now)) return 'Today';
  if (target === manilaToday(new Date(now.getTime() - 86_400_000))) return 'Yesterday';
  return formatDate(iso);
}

/** Splits an already-sorted feed into consecutive day groups. */
export function groupByDay<T extends { createdAt: string }>(
  items: T[],
  now: Date = new Date(),
): Array<{ label: string; items: T[] }> {
  const groups: Array<{ label: string; items: T[] }> = [];
  for (const item of items) {
    const label = notificationDayLabel(item.createdAt, now);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(item);
    else groups.push({ label, items: [item] });
  }
  return groups;
}
