import { describe, expect, it } from 'vitest';
import { reading } from '../test/factories';
import { fitPool } from './fitPool';

describe('fitPool', () => {
  it('returns null when no reading has the unit (missing tokens)', () => {
    expect(fitPool([reading(0, 10), reading(1, 20)], 'tokens')).toBeNull();
  });

  it('ignores zero-percent readings', () => {
    expect(fitPool([reading(0, 0, { tokens: 100 })], 'tokens')).toBeNull();
  });

  it('fits one reading with low confidence', () => {
    const f = fitPool([reading(0, 25, { dollars: 50 })], 'dollars')!;
    expect(f.poolSize).toBeCloseTo(200);
    expect(f.confidence).toBe('low');
    expect(f.n).toBe(1);
  });

  it('is exact on perfectly proportional data and labels high with spread', () => {
    const rs = [10, 20, 35, 50, 70].map((p, i) => reading(i, p, { tokens: p * 1000 }));
    const f = fitPool(rs, 'tokens')!;
    expect(f.poolSize).toBeCloseTo(100_000);
    expect(f.relError).toBeCloseTo(0);
    expect(f.confidence).toBe('high');
  });

  it('labels low when percent spread is small', () => {
    const rs = [40, 42, 44, 45].map((p, i) => reading(i, p, { tokens: p * 10 }));
    expect(fitPool(rs, 'tokens')!.confidence).toBe('low');
  });

  it('labels medium with 3-4 readings or noisy data', () => {
    const three = [10, 30, 60].map((p, i) => reading(i, p, { tokens: p * 10 }));
    expect(fitPool(three, 'tokens')!.confidence).toBe('medium');
    const noisy = [10, 20, 40, 60, 80].map((p, i) => reading(i, p, { tokens: p * 10 * (i % 2 ? 1.4 : 0.7) }));
    expect(fitPool(noisy, 'tokens')!.confidence).toBe('medium');
  });

  it('computes least squares through the origin', () => {
    // k = sum(xy)/sum(xx) = (10*120 + 20*180)/(100+400) = 4800/500 = 9.6
    const f = fitPool([reading(0, 10, { tokens: 120 }), reading(1, 20, { tokens: 180 })], 'tokens')!;
    expect(f.unitsPerPercent).toBeCloseTo(9.6);
    expect(f.poolSize).toBeCloseTo(960);
  });
});
