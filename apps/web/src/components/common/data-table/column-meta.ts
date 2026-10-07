import type { ColumnDef } from '@tanstack/react-table';

/** Presentation hints read by DataTable; set them through a column's `meta`. */
export type ColumnPresentation = {
  /** Right-align and use tabular numerals (money, quantities). */
  numeric?: boolean;
  /** Pin to the left edge while scrolling horizontally. */
  sticky?: boolean;
  /** Hide the column below this breakpoint. */
  hideBelow?: 'sm' | 'md' | 'lg';
  /** Human label for the column visibility menu when the header is not plain text. */
  label?: string;
};

export type DataColumn<T> = ColumnDef<T> & { meta?: ColumnPresentation };

/** TanStack types `meta` as an empty interface; this narrows it back to what DataTable understands. */
export function presentation(meta: unknown): ColumnPresentation {
  return (meta ?? {}) as ColumnPresentation;
}
