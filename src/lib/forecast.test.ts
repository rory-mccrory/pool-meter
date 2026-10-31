import { describe, expect, it } from 'vitest';
import { account, H, reading, T0 } from '../test/factories';
import { forecast } from './forecast';

const resetIn = (hours: number) => account({ resetAt: new Date(T0 + hours * H).toISOString() });

describe('forecast', () => {
  it('is unknown with no readings but still reports a configured reset', () => {
    const f = forecast(resetIn(48), [], T0);
    expect(f.status).toBe('unknown');
    expect(f.hoursToReset).toBeCloseTo(48);
  });

  it('is unknown with no readings and no reset', () => {
    const f = forecast(account(), [], T0);
    expect(f.status).toBe('unknown');
    expect(f.reset).toBeNull();
  });

  it('handles one reading with a fixed reset (burn since window start)', () => {
    // reset at T0+100h means the window started at T0+100h-168h = T0-68h
    const f = forecast(resetIn(100), [reading(0, 34)], T0);
    expect(f.burn!.method).toBe('since-window-start');
    expect(f.burn!.pctPerHour).toBeCloseTo(0.5);
    expect(f.status).toBe('safe');
  });

  it('needs two readings for a rolling window', () => {
    const f = forecast(account({ windowType: 'weekly-rolling' }), [reading(0, 10)], T0 + H);
    expect(f.status).toBe('unknown');
    expect(f.message).toMatch(/second reading/);
  });

  it('flags will-run-dry when exhaustion precedes reset', () => {
    const f = forecast(resetIn(100), [reading(0, 10), reading(10, 30)], T0 + 10 * H);
    expect(f.burn!.pctPerHour).toBeCloseTo(2);
    expect(f.exhaustionAt).toBe(T0 + 45 * H);
    expect(f.status).toBe('dry');
  });

  it('flags tight when projected usage at reset is high', () => {
    const f = forecast(resetIn(40), [reading(0, 40), reading(10, 50)], T0 + 10 * H);
    // 50 + 1*30 = 80 -> safe; bump to 90
    expect(f.status).toBe('safe');
    const g = forecast(resetIn(45), [reading(0, 40), reading(10, 50)], T0 + 10 * H);
    expect(g.projectedAtReset).toBeCloseTo(85);
    expect(g.status).toBe('tight');
  });

  it('is safe with zero burn and has no exhaustion time', () => {
    const f = forecast(resetIn(48), [reading(0, 40), reading(10, 40)], T0 + 10 * H);
    expect(f.burn!.pctPerHour).toBe(0);
    expect(f.exhaustionAt).toBeNull();
    expect(f.status).toBe('safe');
  });

  it('starts a new window after a percent drop', () => {
    const f = forecast(resetIn(200), [reading(0, 50), reading(10, 95), reading(20, 3), reading(30, 13)], T0 + 30 * H);
    expect(f.windowCount).toBe(2);
    expect(f.currentWindow).toHaveLength(2);
    expect(f.burn!.pctPerHour).toBeCloseTo(1);
  });

  it('handles identical timestamps without NaN', () => {
    const f = forecast(resetIn(48), [reading(0, 10), reading(0, 10), reading(5, 20)], T0 + 5 * H);
    expect(Number.isFinite(f.burn!.pctPerHour)).toBe(true);
    expect(f.burn!.pctPerHour).toBeCloseTo(2);
  });

  it('treats a passed reset boundary as a fresh window', () => {
    const f = forecast(resetIn(24), [reading(0, 10), reading(10, 60)], T0 + 30 * H);
    expect(f.windowReset).toBe(true);
    expect(f.lastPercent).toBe(0);
    expect(f.percentNow).toBeCloseTo(30);
  });

  it('marks an exhausted pool as dry', () => {
    const f = forecast(resetIn(48), [reading(0, 100)], T0 + H);
    expect(f.status).toBe('dry');
    expect(f.percentNow).toBe(100);
  });

  it('computes headroom per hour', () => {
    const f = forecast(resetIn(50), [reading(0, 40), reading(10, 50)], T0 + 10 * H);
    expect(f.headroomPerHour).toBeCloseTo(50 / 40);
  });

  it('includes pool fits when units are present', () => {
    const f = forecast(resetIn(48), [reading(0, 10, { dollars: 20 }), reading(5, 30, { dollars: 60 })], T0 + 5 * H);
    expect(f.pools.dollars!.poolSize).toBeCloseTo(200);
    expect(f.pools.tokens).toBeNull();
  });
});
