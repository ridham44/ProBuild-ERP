import { MONTH_NAMES } from '@/features/company/schemas';
import { manilaToday } from '@/lib/format';

/** Counts come from list endpoints capped at `limit`; a next cursor means there are more than shown. */
export type CappedCount = { count: number; capped: boolean };

export function cappedCount(
  page: { items: unknown[]; nextCursor: string | null } | undefined,
): CappedCount | null {
  return page ? { count: page.items.length, capped: page.nextCursor !== null } : null;
}

export function formatCappedCount(value: CappedCount | null): string {
  if (!value) return '';
  return `${value.count}${value.capped ? '+' : ''}`;
}

/** Hour of the day on the Manila clock, for the greeting. */
export function manilaHour(now: Date = new Date()): number {
  return Number(
    new Intl.DateTimeFormat('en-PH', { hour: 'numeric', hourCycle: 'h23', timeZone: 'Asia/Manila' }).format(now),
  );
}

export function greeting(now: Date = new Date()): string {
  const hour = manilaHour(now);
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

/** "Friday, 09 Oct 2026" on the Manila calendar. */
export function todayLabel(now: Date = new Date()): string {
  const weekday = new Intl.DateTimeFormat('en-PH', { weekday: 'long', timeZone: 'Asia/Manila' }).format(now);
  const [year, month, day] = manilaToday(now).split('-').map(Number);
  return `${weekday}, ${String(day).padStart(2, '0')} ${MONTH_NAMES[(month ?? 1) - 1]?.slice(0, 3)} ${year}`;
}
