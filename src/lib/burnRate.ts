import type { Reading } from '../model';
import { HOUR_MS, toMs } from './time';
import { sortReadings } from './windows';

export interface BurnInterval {
  from: number;
  to: number;
  /** Percentage points consumed in the interval (never negative). */
  deltaPercent: number;
  /** Percentage points per hour. */
  rate: number;
}

/**
 * Consecutive-reading intervals within one window. Intervals with zero duration
 * (identical timestamps) are skipped; small negative deltas (dashboard rounding or
 * rolling-window decay under the reset threshold) count as zero burn.
 */
export function intervals(windowReadings: readonly Reading[]): BurnInterval[] {
  const sorted = sortReadings(windowReadings);
  const out: BurnInterval[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const a = sorted[i - 1]!;
    const b = sorted[i]!;
    const from = toMs(a.at);
    const to = toMs(b.at);
    const dt = to - from;
    if (dt <= 0) continue;
    const deltaPercent = Math.max(0, b.percentUsed - a.percentUsed);
    out.push({ from, to, deltaPercent, rate: deltaPercent / (dt / HOUR_MS) });
  }
  return out;
}

export interface BurnRate {
  /** Weighted percentage points per hour. */
  pctPerHour: number;
  /** Number of intervals (or 1 for a single reading measured from window start). */
  samples: number;
  method: 'weighted' | 'since-window-start';
}

/** Recency half-life for weighting intervals. */
export const BURN_HALF_LIFE_MS = 24 * HOUR_MS;
/** Only the last N intervals contribute. */
export const BURN_MAX_INTERVALS = 8;

/**
 * Weighted burn rate in percent per hour over the recent readings of one window.
 * Each interval is weighted by its duration times an exponential recency decay
 * (half-life 24h measured from the latest reading), so long recent stretches matter
 * most. With a single reading and a known window start, falls back to
 * percent / hours since the start. Returns null when there is nothing to measure.
 */
export function burnRate(windowReadings: readonly Reading[], windowStart?: number): BurnRate | null {
  const ivs = intervals(windowReadings).slice(-BURN_MAX_INTERVALS);
  if (ivs.length === 0) {
    const sorted = sortReadings(windowReadings);
    const last = sorted[sorted.length - 1];
    if (!last || windowStart === undefined) return null;
    const hours = (toMs(last.at) - windowStart) / HOUR_MS;
    if (hours <= 0) return null;
    return { pctPerHour: Math.max(0, last.percentUsed) / hours, samples: 1, method: 'since-window-start' };
  }
  const latest = ivs[ivs.length - 1]!.to;
  let num = 0;
  let den = 0;
  for (const iv of ivs) {
    const age = latest - iv.to;
    const w = (iv.to - iv.from) * Math.pow(0.5, age / BURN_HALF_LIFE_MS);
    num += iv.rate * w;
    den += w;
  }
  return { pctPerHour: den > 0 ? num / den : 0, samples: ivs.length, method: 'weighted' };
}
