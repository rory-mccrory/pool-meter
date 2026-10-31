import { describe, expect, it } from 'vitest';
import type { SpikeTag } from '../model';
import { reading } from '../test/factories';
import { detectSpikes, tagTotals } from './detectSpikes';

describe('detectSpikes', () => {
  it('finds nothing with too few intervals', () => {
    expect(detectSpikes([reading(0, 0), reading(1, 50)]).spikes).toEqual([]);
  });

  it('flags intervals above 3x the median', () => {
    const rs = [reading(0, 0), reading(1, 1), reading(2, 2), reading(3, 3), reading(4, 13), reading(5, 14)];
    const r = detectSpikes(rs);
    expect(r.medianRate).toBe(1);
    expect(r.spikes).toHaveLength(1);
    expect(r.spikes[0]!.deltaPercent).toBe(10);
    expect(r.totalBurn).toBe(14);
  });

  it('does not flag exactly 3x', () => {
    const rs = [reading(0, 0), reading(1, 1), reading(2, 2), reading(3, 5)];
    expect(detectSpikes(rs).spikes).toHaveLength(0);
  });

  it('falls back to the median of non-zero rates when idle dominates', () => {
    const rs = [reading(0, 5), reading(1, 5), reading(2, 5), reading(3, 5), reading(4, 5), reading(5, 6), reading(6, 7), reading(7, 17)];
    const r = detectSpikes(rs);
    expect(r.medianRate).toBe(1);
    expect(r.spikes).toHaveLength(1);
  });

  it('returns no spikes for zero burn', () => {
    const rs = [reading(0, 5), reading(1, 5), reading(2, 5), reading(3, 5)];
    expect(detectSpikes(rs).spikes).toEqual([]);
  });

  it('does not count the reset drop as an interval', () => {
    const rs = [reading(0, 80), reading(1, 81), reading(2, 82), reading(3, 2), reading(4, 3), reading(5, 4)];
    const r = detectSpikes(rs);
    expect(r.intervalCount).toBe(4);
    expect(r.spikes).toEqual([]);
  });
});

describe('tagTotals', () => {
  it('sums tagged spike burn as a share of total burn', () => {
    const rs = [reading(0, 0), reading(1, 1), reading(2, 2), reading(3, 12), reading(4, 13), reading(5, 23)];
    const report = detectSpikes(rs);
    expect(report.spikes).toHaveLength(2);
    const s = report.spikes[0]!;
    const tags: SpikeTag[] = [
      { id: 't', accountId: 'a1', from: new Date(s.from).toISOString(), to: new Date(s.to).toISOString(), tag: 'agent-chatter' },
    ];
    const totals = tagTotals(report, tags, 'a1');
    const chatter = totals.find((t) => t.tag === 'agent-chatter')!;
    const untagged = totals.find((t) => t.tag === 'untagged')!;
    expect(chatter.burn).toBe(10);
    expect(chatter.share).toBeCloseTo(10 / 23);
    expect(untagged.burn).toBe(10);
  });

  it('returns zero shares when nothing burned', () => {
    const totals = tagTotals({ medianRate: 0, spikes: [], totalBurn: 0, intervalCount: 0 }, [], 'a1');
    expect(totals.every((t) => t.share === 0)).toBe(true);
  });
});
