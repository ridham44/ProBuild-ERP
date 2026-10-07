// Business dates in the Philippines follow Asia/Manila (UTC+8, no daylight saving).
// Accounting periods, document-number years and "today" must use these helpers, never UTC getters.

export const MANILA_TIME_ZONE = 'Asia/Manila';
const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;

export type ManilaParts = { year: number; month: number; day: number };

/** Calendar parts of an instant as seen on a wall clock in Manila. month is 1-12. */
export function manilaParts(date: Date): ManilaParts {
  const shifted = new Date(date.getTime() + MANILA_OFFSET_MS);
  return { year: shifted.getUTCFullYear(), month: shifted.getUTCMonth() + 1, day: shifted.getUTCDate() };
}

/** The instant at which the given Manila calendar day starts (00:00 +08:00). */
export function startOfManilaDay(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day) - MANILA_OFFSET_MS);
}

/** First instant of a Manila month, and the first instant of the following month (exclusive end). */
export function manilaMonthRange(year: number, month: number): { start: Date; endExclusive: Date } {
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  return { start: startOfManilaDay(year, month, 1), endExclusive: startOfManilaDay(nextYear, nextMonth, 1) };
}

/** YYYY-MM-DD in Manila, for display and CSV exports. */
export function manilaDateString(date: Date): string {
  const { year, month, day } = manilaParts(date);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
