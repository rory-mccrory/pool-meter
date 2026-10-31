import { describe, expect, it } from 'vitest';
import { reading, T0 } from '../test/factories';
import { burnRate, intervals } from './burnRate';

describe('intervals', () => {
  it('skips identical timestamps', () => {
    const iv = intervals([reading(0, 10), reading(0, 12), reading(2, 16)]);
    expect(iv).toHaveLength(1);
    expect(iv[0]!.rate).toBeCloseTo(2);
  });

  it('treats small decreases as zero burn', () => {
    expect(intervals([reading(0, 30), reading(1, 25)])[0]!.deltaPercent).toBe(0);
  });
});

describe('burnRate', () => {
  it('returns null for one reading without window start', () => {
    expect(burnRate([reading(0, 10)])).toBeNull();
  });

  it('uses percent since window start for one reading', () => {
    const b = burnRate([reading(10, 20)], T0)!;
    expect(b.pctPerHour).toBeCloseTo(2);
    expect(b.method).toBe('since-window-start');
  });

  it('returns null for identical timestamps only', () => {
    expect(burnRate([reading(3, 10), reading(3, 20)])).toBeNull();
  });

  it('returns zero for flat usage', () => {
    expect(burnRate([reading(0, 40), reading(5, 40), reading(9, 40)])!.pctPerHour).toBe(0);
  });

  it('equals the simple rate for constant burn', () => {
    expect(burnRate([reading(0, 0), reading(10, 10), reading(20, 20)])!.pctPerHour).toBeCloseTo(1);
  });

  it('weights recent intervals more heavily', () => {
    // old: 1%/h for 24h, recent: 4%/h for 24h -> weighted toward 4
    const b = burnRate([reading(0, 0), reading(24, 24), reading(48, 120)])!;
    expect(b.pctPerHour).toBeGreaterThan(2.5);
    expect(b.pctPerHour).toBeLessThan(4);
  });

  it('only uses the last 8 intervals', () => {
    const rs = [reading(0, 0), reading(1, 50)];
    for (let i = 0; i < 8; i++) rs.push(reading(2 + i, 50 + i));
    const b = burnRate(rs)!;
    expect(b.samples).toBe(8);
    expect(b.pctPerHour).toBeLessThan(2);
  });
});
