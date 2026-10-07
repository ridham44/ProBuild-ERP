'use client';

import * as React from 'react';
import { Input } from '@/components/ui/input';
import { manilaToday } from '@/lib/format';

export type DatePickerProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'type' | 'value' | 'onChange' | 'min' | 'max'
> & {
  /** Calendar date as YYYY-MM-DD (Asia/Manila business date), or empty string. */
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  /** Prevent choosing a date before today in Manila. */
  disablePast?: boolean;
};

/**
 * Business dates are plain calendar days in Asia/Manila. The native date control gives a calendar popup,
 * keyboard entry and localisation for free, and its value is already a time-zone-free YYYY-MM-DD string.
 */
export const DatePicker = React.forwardRef<HTMLInputElement, DatePickerProps>(function DatePicker(
  { value, onChange, min, max, disablePast, ...props },
  ref,
) {
  const lower = disablePast ? (min && min > manilaToday() ? min : manilaToday()) : min;
  return (
    <Input
      ref={ref}
      type="date"
      value={value}
      min={lower}
      max={max}
      onChange={(event) => onChange(event.target.value)}
      {...props}
    />
  );
});
