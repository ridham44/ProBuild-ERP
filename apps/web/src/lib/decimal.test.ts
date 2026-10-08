import { describe, expect, it } from 'vitest';
import { computeLineMoney, mulDecimal, pctDecimal, subDecimal, sumDecimal } from './decimal';

describe('decimal arithmetic', () => {
  it('adds without float error', () => {
    expect(sumDecimal(['0.1', '0.2'])).toBe('0.30');
    expect(subDecimal('1.00', '0.99')).toBe('0.01');
  });

  it('multiplies and rounds half up to 2 decimals', () => {
    expect(mulDecimal('3', '16.835')).toBe('50.51');
    expect(mulDecimal('1200', '735')).toBe('882000.00');
  });

  it('takes a percentage', () => {
    expect(pctDecimal('1158400', '12')).toBe('139008.00');
    expect(pctDecimal('100', '0.5')).toBe('0.50');
  });

  it('computes a line like the API: tax on the discounted amount, each part rounded', () => {
    expect(computeLineMoney({ qty: '8000', unitPrice: '16.8', discountPct: '2.5', taxPct: '12' })).toEqual({
      gross: '134400.00',
      discount: '3360.00',
      net: '131040.00',
      tax: '15724.80',
      total: '146764.80',
    });
  });

  it('treats anything that is not a plain decimal as zero', () => {
    expect(sumDecimal(['abc', '1e3', '2'])).toBe('2.00');
  });
});
