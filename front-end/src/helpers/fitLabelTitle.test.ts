import { describe, expect, it } from 'vitest';
import { fitLabelTitle } from './fitLabelTitle';

describe('fitLabelTitle', () => {
  const measure = (text: string) => Array.from(text).length * 10;
  it('preserves a fitting title including an empty one', () => {
    expect(fitLabelTitle('Gốm Việt', measure, 80)).toBe('Gốm Việt');
    expect(fitLabelTitle('', measure, 80)).toBe('');
  });
  it('includes ellipsis width in the fitted result', () => {
    expect(fitLabelTitle('Bình gốm Việt', measure, 50)).toBe('Bình…');
    expect(fitLabelTitle('abc', measure, 5)).toBe('');
  });
  it('does not split a Unicode code point', () => {
    expect(fitLabelTitle('🏺🏺🏺🏺', measure, 30)).toBe('🏺🏺…');
  });
  it('bounds expensive measurements even for very long API titles', () => {
    let measurements = 0;
    const width = (text: string) => { measurements++; return measure(text); };
    expect(fitLabelTitle('A'.repeat(4096), width, 450)).toBe(`${'A'.repeat(44)}…`);
    expect(measurements).toBeLessThanOrEqual(15);
  });
});
