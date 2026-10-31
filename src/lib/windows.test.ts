import { describe, expect, it } from 'vitest';
import { account, H, reading, T0 } from '../test/factories';
import { nextReset, splitWindows } from './windows';

describe('splitWindows', () => {
  it('returns nothing for no readings', () => {
    expect(splitWindows([])).toEqual([]);
  });

  it('keeps one reading in one window', () => {
    const w = splitWindows([reading(0, 10)]);
    expect(w).toHaveLength(1);
    expect(w[0]!.readings).toHaveLength(1);
  });

  it('starts a new window when percent drops more than 20 points', () => {
    const w = splitWindows([reading(0, 50), reading(5, 90), reading(10, 5), reading(12, 9)]);
    expect(w.map((x) => x.readings.map((r) => r.percentUsed))).toEqual([[50, 90], [5, 9]]);
  });

  it('does not split on a drop of exactly 20 points or less', () => {
    expect(splitWindows([reading(0, 40), reading(1, 20)])).toHaveLength(1);
    expect(splitWindows([reading(0, 40), reading(1, 19.9)])).toHaveLength(2);
  });

  it('sorts unsorted input before splitting', () => {
    const w = splitWindows([reading(10, 5), reading(0, 80)]);
    expect(w).toHaveLength(2);
    expect(w[0]!.readings[0]!.percentUsed).toBe(80);
  });
});

describe('nextReset', () => {
  it('rolls a past configured reset forward by weeks', () => {
    const a = account({ resetAt: new Date(T0).toISOString() });
    const r = nextReset(a, undefined, T0 + 10 * 24 * H)!;
    expect(r.at).toBe(T0 + 14 * 24 * H);
    expect(r.previous).toBe(T0 + 7 * 24 * H);
    expect(r.estimated).toBe(false);
  });

  it('rolls a far-future configured reset back to the next boundary', () => {
    const a = account({ resetAt: new Date(T0 + 21 * 24 * H).toISOString() });
    expect(nextReset(a, undefined, T0 + H)!.at).toBe(T0 + 7 * 24 * H);
  });

  it('estimates from the window start when no reset is configured', () => {
    const r = nextReset(account(), T0, T0 + H)!;
    expect(r.at).toBe(T0 + 7 * 24 * H);
    expect(r.estimated).toBe(true);
  });

  it('uses calendar months for monthly windows', () => {
    const a = account({ windowType: 'monthly', resetAt: new Date(Date.UTC(2026, 0, 31)).toISOString() });
    expect(new Date(nextReset(a, undefined, Date.UTC(2026, 1, 1))!.at).toISOString()).toBe('2026-02-28T00:00:00.000Z');
  });

  it('returns null with no anchor', () => {
    expect(nextReset(account(), undefined, T0)).toBeNull();
  });
});
