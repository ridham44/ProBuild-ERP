import { describe, expect, it } from 'vitest';
import { toCsv } from './csv';

describe('toCsv', () => {
  it('joins rows with CRLF and cells with commas', () => {
    expect(toCsv([['a', 'b'], [1, 2]])).toBe('a,b\r\n1,2');
  });

  it('quotes cells with commas, quotes and line breaks, doubling inner quotes', () => {
    expect(toCsv([['Cement, 40kg', 'say "hi"', 'two\nlines']])).toBe('"Cement, 40kg","say ""hi""","two\nlines"');
  });

  it('writes null and undefined as empty cells', () => {
    expect(toCsv([['x', null, undefined, 0]])).toBe('x,,,0');
  });
});
