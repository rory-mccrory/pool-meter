import type { Reading, SpikeTag, SpikeTagKind } from '../model';
import { SPIKE_TAGS } from '../model';
import { intervals, type BurnInterval } from './burnRate';
import { toMs } from './time';
import { splitWindows } from './windows';

export const SPIKE_MULTIPLIER = 3;
/** Need at least this many intervals before a median is meaningful. */
export const MIN_INTERVALS_FOR_SPIKES = 3;

export interface Spike extends BurnInterval {
  /** rate / median */
  ratio: number;
}

export interface SpikeReport {
  medianRate: number;
  spikes: Spike[];
  /** Total percentage points burned across all intervals of all windows. */
  totalBurn: number;
  intervalCount: number;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

/**
 * Flags intervals whose burn rate exceeds `multiplier` times the account's median
 * interval rate (computed over every window). When the median is zero (mostly idle
 * readings) the median of the non-zero rates is used instead so a single busy hour
 * is not compared against nothing.
 */
export function detectSpikes(readings: readonly Reading[], multiplier = SPIKE_MULTIPLIER): SpikeReport {
  const all = splitWindows(readings).flatMap((w) => intervals(w.readings));
  const totalBurn = all.reduce((s, iv) => s + iv.deltaPercent, 0);
  if (all.length < MIN_INTERVALS_FOR_SPIKES) {
    return { medianRate: median(all.map((i) => i.rate)), spikes: [], totalBurn, intervalCount: all.length };
  }
  let med = median(all.map((i) => i.rate));
  if (med === 0) med = median(all.filter((i) => i.rate > 0).map((i) => i.rate));
  if (med === 0) return { medianRate: 0, spikes: [], totalBurn, intervalCount: all.length };
  const spikes = all
    .filter((iv) => iv.rate > multiplier * med)
    .map((iv) => ({ ...iv, ratio: iv.rate / med }));
  return { medianRate: med, spikes, totalBurn, intervalCount: all.length };
}

export function spikeKey(from: number, to: number): string {
  return `${from}-${to}`;
}

export function findTag(tags: readonly SpikeTag[], accountId: string, spike: BurnInterval): SpikeTag | undefined {
  return tags.find(
    (t) => t.accountId === accountId && toMs(t.from) === spike.from && toMs(t.to) === spike.to,
  );
}

export interface TagTotal {
  tag: SpikeTagKind | 'untagged';
  burn: number;
  /** Share of the account's total burn, 0..1. */
  share: number;
}

/** Percentage points burned in spikes, grouped by tag, as a share of all burn. */
export function tagTotals(
  report: SpikeReport,
  tags: readonly SpikeTag[],
  accountId: string,
): TagTotal[] {
  const sums = new Map<TagTotal['tag'], number>();
  for (const k of [...SPIKE_TAGS, 'untagged' as const]) sums.set(k, 0);
  for (const s of report.spikes) {
    const tag = findTag(tags, accountId, s)?.tag ?? 'untagged';
    sums.set(tag, (sums.get(tag) ?? 0) + s.deltaPercent);
  }
  return [...sums.entries()].map(([tag, burn]) => ({
    tag,
    burn,
    share: report.totalBurn > 0 ? burn / report.totalBurn : 0,
  }));
}
