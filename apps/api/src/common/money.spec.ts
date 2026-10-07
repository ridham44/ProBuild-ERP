import { describe, expect, it } from 'vitest';
import { computeLine, dec, estimateTotals, nonNegative, round2, sumLines, variancePct } from './money';

describe('round2', () => {
  it('rounds half up at the second decimal', () => {
    expect(round2('0.005').toString()).toBe('0.01');
    expect(round2('0.004').toString()).toBe('0');
    expect(round2('1.005').toString()).toBe('1.01');
    expect(round2('2.675').toString()).toBe('2.68');
    expect(round2('-0.005').toString()).toBe('-0.01');
  });

  it('is exact where binary floats are not', () => {
    // 0.1 + 0.2 !== 0.3 as floats; decimals must agree.
    expect(dec('0.1').plus('0.2').equals('0.3')).toBe(true);
    expect(round2(dec('19.99').mul('3')).toString()).toBe('59.97');
  });
});

describe('computeLine', () => {
  it('computes gross, discount, net, tax and total with line-level rounding', () => {
    const line = computeLine({ qty: '10', unitPrice: '250.50', discountPct: '5', taxPct: '12' });
    expect(line.gross.toString()).toBe('2505');
    expect(line.discount.toString()).toBe('125.25');
    expect(line.net.toString()).toBe('2379.75');
    expect(line.tax.toString()).toBe('285.57');
    expect(line.total.toString()).toBe('2665.32');
  });

  it('rounds the gross of fractional quantities and 4dp prices to 2dp', () => {
    const line = computeLine({ qty: '3.3333', unitPrice: '1.2345' });
    // 3.3333 x 1.2345 = 4.11489...
    expect(line.gross.toString()).toBe('4.11');
    expect(line.tax.toString()).toBe('0');
    expect(line.total.toString()).toBe('4.11');
  });

  it('applies tax on the discounted amount, not the gross', () => {
    const line = computeLine({ qty: '1', unitPrice: '1000', discountPct: '10', taxPct: '12' });
    expect(line.net.toString()).toBe('900');
    expect(line.tax.toString()).toBe('108');
  });

  it('treats missing percentages as zero', () => {
    const line = computeLine({ qty: '2', unitPrice: '99.99' });
    expect(line.discount.toString()).toBe('0');
    expect(line.tax.toString()).toBe('0');
    expect(line.total.toString()).toBe('199.98');
  });

  it('rounds tax half-up per line', () => {
    // net 0.50 x 1% = 0.005 -> 0.01
    expect(computeLine({ qty: '1', unitPrice: '0.50', taxPct: '1' }).tax.toString()).toBe('0.01');
  });
});

describe('sumLines', () => {
  it('sums rounded lines so the document always equals the sum of its lines', () => {
    const lines = [
      computeLine({ qty: '1', unitPrice: '0.50', taxPct: '1' }),
      computeLine({ qty: '1', unitPrice: '0.50', taxPct: '1' }),
      computeLine({ qty: '1', unitPrice: '0.50', taxPct: '1' }),
    ];
    const totals = sumLines(lines);
    // 3 x 0.01 = 0.03, not round(3 x 0.005) = 0.02: tax is rounded per line, not on the document.
    expect(totals.tax.toString()).toBe('0.03');
    expect(totals.total.toString()).toBe('1.53');
  });

  it('adds freight after discount and tax', () => {
    const totals = sumLines([computeLine({ qty: '10', unitPrice: '100', discountPct: '10', taxPct: '12' })], '150.505');
    expect(totals.subtotal.toString()).toBe('1000');
    expect(totals.discount.toString()).toBe('100');
    expect(totals.tax.toString()).toBe('108');
    expect(totals.freight.toString()).toBe('150.51');
    expect(totals.total.toString()).toBe('1158.51');
  });

  it('is zero for no lines', () => {
    expect(sumLines([]).total.toString()).toBe('0');
  });
});

describe('variancePct', () => {
  it('measures how far above the baseline a price is', () => {
    expect(variancePct('110', '100')?.toString()).toBe('10');
    expect(variancePct('105.55', '100')?.toString()).toBe('5.55');
    expect(variancePct('100', '100')?.toString()).toBe('0');
  });

  it('rounds to two decimals half up and is null without a baseline', () => {
    expect(variancePct('100.0069', '100')?.toString()).toBe('0.01');
    expect(variancePct('5', '0')).toBeNull();
  });
});

describe('estimateTotals', () => {
  it('rolls up overhead and profit on direct cost, then tax on the subtotal', () => {
    const totals = estimateTotals(['1000.00', '2500.50'], { overheadPct: '10', profitPct: '8', taxPct: '12' });
    expect(totals.directCost.toString()).toBe('3500.5');
    expect(totals.overhead.toString()).toBe('350.05');
    expect(totals.profit.toString()).toBe('280.04');
    expect(totals.tax.toString()).toBe('495.67');
    expect(totals.total.toString()).toBe('4626.26');
  });

  it('is zero for an empty BOQ', () => {
    expect(estimateTotals([], { overheadPct: '10', profitPct: '10', taxPct: '12' }).total.toString()).toBe('0');
  });
});

describe('nonNegative', () => {
  it('floors at zero', () => {
    expect(nonNegative('-3').toString()).toBe('0');
    expect(nonNegative('2.5').toString()).toBe('2.5');
  });
});
