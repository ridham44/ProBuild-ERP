'use client';

import * as React from 'react';
import { Input } from '@/components/ui/input';
import { formatPHP, formatQty } from '@/lib/format';
import { cn } from '@/lib/utils';

type BaseProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange' | 'type' | 'inputMode'
> & {
  /** Decimal string, never a float, so money and quantities keep exact precision. */
  value: string;
  onChange: (value: string) => void;
};

/** Keeps digits and one decimal point, limited to `decimals` places. */
export function sanitizeDecimal(raw: string, decimals: number, allowNegative: boolean): string {
  const negative = allowNegative && raw.trim().startsWith('-');
  const cleaned = raw.replace(/[^\d.]/g, '');
  const [whole = '', ...rest] = cleaned.split('.');
  const fraction = rest.join('').slice(0, decimals);
  const hasDot = rest.length > 0 && decimals > 0;
  return `${negative ? '-' : ''}${whole}${hasDot ? `.${fraction}` : ''}`;
}

type DecimalFieldProps = BaseProps & {
  decimals: number;
  allowNegative?: boolean;
  prefix?: string;
  suffix?: string;
  formatDisplay: (value: string) => string;
};

const DecimalField = React.forwardRef<HTMLInputElement, DecimalFieldProps>(function DecimalField(
  {
    value,
    onChange,
    decimals,
    allowNegative = false,
    prefix,
    suffix,
    formatDisplay,
    className,
    onBlur,
    onFocus,
    ...props
  },
  ref,
) {
  const [focused, setFocused] = React.useState(false);
  const shown = focused || value === '' ? value : formatDisplay(value);
  return (
    <div className="relative">
      {prefix ? (
        <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
          {prefix}
        </span>
      ) : null}
      <Input
        ref={ref}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={shown}
        onChange={(event) => onChange(sanitizeDecimal(event.target.value, decimals, allowNegative))}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        className={cn('num text-right', prefix && 'pl-7', suffix && 'pr-10', className)}
        {...props}
      />
      {suffix ? (
        <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
          {suffix}
        </span>
      ) : null}
    </div>
  );
});

function displayMoney(value: string): string {
  return formatPHP(value, { symbol: false });
}

export type CurrencyInputProps = BaseProps & { allowNegative?: boolean };

/** Philippine peso amount, two decimals, grouped when not focused. Emits a plain decimal string. */
export const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
  function CurrencyInput(props, ref) {
    return (
      <DecimalField ref={ref} decimals={2} prefix="₱" formatDisplay={displayMoney} {...props} />
    );
  },
);

export type QuantityInputProps = BaseProps & { unit?: string; decimals?: number };

/** Quantity with an optional unit of measure shown inside the field. */
export const QuantityInput = React.forwardRef<HTMLInputElement, QuantityInputProps>(
  function QuantityInput({ unit, decimals = 4, ...props }, ref) {
    return (
      <DecimalField
        ref={ref}
        decimals={decimals}
        {...(unit ? { suffix: unit } : {})}
        formatDisplay={(value) => formatQty(value, undefined, decimals)}
        {...props}
      />
    );
  },
);
