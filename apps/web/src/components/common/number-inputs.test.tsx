import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as React from 'react';
import { describe, expect, it } from 'vitest';
import { CurrencyInput, QuantityInput, sanitizeDecimal } from './number-inputs';

function Harness({
  initial = '',
  children,
}: {
  initial?: string;
  children: (value: string, set: (v: string) => void) => React.ReactNode;
}) {
  const [value, setValue] = React.useState(initial);
  return (
    <>
      {children(value, setValue)}
      <output data-testid="value">{value}</output>
    </>
  );
}

describe('sanitizeDecimal', () => {
  it('keeps digits and a single decimal point within the limit', () => {
    expect(sanitizeDecimal('1,234.567', 2, false)).toBe('1234.56');
    expect(sanitizeDecimal('12.3.4', 4, false)).toBe('12.34');
    expect(sanitizeDecimal('abc', 2, false)).toBe('');
  });

  it('allows a leading minus only when negatives are allowed', () => {
    expect(sanitizeDecimal('-5', 2, true)).toBe('-5');
    expect(sanitizeDecimal('-5', 2, false)).toBe('5');
  });

  it('drops the fraction when no decimals are allowed', () => {
    expect(sanitizeDecimal('10.5', 0, false)).toBe('10');
  });
});

describe('CurrencyInput', () => {
  it('emits a plain decimal string and groups digits when not focused', async () => {
    const user = userEvent.setup();
    render(
      <Harness>
        {(value, set) => <CurrencyInput aria-label="Amount" value={value} onChange={set} />}
      </Harness>,
    );
    const input = screen.getByLabelText('Amount');
    await user.click(input);
    await user.type(input, '1234567.891');
    expect(screen.getByTestId('value')).toHaveTextContent('1234567.89');
    await user.tab();
    expect(input).toHaveValue('1,234,567.89');
    await user.click(input);
    expect(input).toHaveValue('1234567.89');
  });

  it('right-aligns with tabular numerals and shows the peso prefix', () => {
    render(<CurrencyInput aria-label="Amount" value="10" onChange={() => undefined} />);
    expect(screen.getByLabelText('Amount')).toHaveClass('text-right', 'num');
    expect(screen.getByText('₱')).toBeInTheDocument();
  });
});

describe('QuantityInput', () => {
  it('limits decimals and shows the unit', async () => {
    const user = userEvent.setup();
    render(
      <Harness>
        {(value, set) => (
          <QuantityInput aria-label="Qty" unit="bags" decimals={2} value={value} onChange={set} />
        )}
      </Harness>,
    );
    await user.type(screen.getByLabelText('Qty'), '12.3456');
    expect(screen.getByTestId('value')).toHaveTextContent('12.34');
    expect(screen.getByText('bags')).toBeInTheDocument();
  });
});
