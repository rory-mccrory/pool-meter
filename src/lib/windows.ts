import type { Account, Reading } from '../model';
import { addPeriod, periodMs, toMs } from './time';

/** A percent drop larger than this between consecutive readings starts a new window. */
export const RESET_DROP_POINTS = 20;

export interface UsageWindow {
  index: number;
  readings: Reading[];
}

export function sortReadings(readings: readonly Reading[]): Reading[] {
  return [...readings].sort((a, b) => toMs(a.at) - toMs(b.at) || a.id.localeCompare(b.id));
}

/**
 * Splits an account's readings into usage windows. A new window starts whenever
 * percent used drops by more than RESET_DROP_POINTS between consecutive readings.
 */
export function splitWindows(readings: readonly Reading[]): UsageWindow[] {
  const sorted = sortReadings(readings);
  const windows: UsageWindow[] = [];
  let current: Reading[] = [];
  for (const r of sorted) {
    const prev = current[current.length - 1];
    if (prev && prev.percentUsed - r.percentUsed > RESET_DROP_POINTS) {
      windows.push({ index: windows.length, readings: current });
      current = [];
    }
    current.push(r);
  }
  if (current.length) windows.push({ index: windows.length, readings: current });
  return windows;
}

export interface ResetInfo {
  /** Next reset strictly after `now`. */
  at: number;
  /** The reset boundary before `at` (start of the current period). */
  previous: number;
  /** True when no reset time is configured and we inferred it from the readings. */
  estimated: boolean;
}

/**
 * Next reset after `now`. Boundaries are anchor + k periods (computed from the
 * anchor each time, so monthly resets do not drift). A configured resetAt is the
 * anchor and may be in the past or future. Without one, the period is anchored at
 * `windowStart` (the first reading of the current window) and the first boundary is
 * one period after it.
 */
export function nextReset(account: Account, windowStart: number | undefined, now: number): ResetInfo | null {
  const anchor = account.resetAt ? toMs(account.resetAt) : windowStart;
  if (anchor === undefined || !Number.isFinite(anchor)) return null;
  const estimated = !account.resetAt;
  const type = account.windowType;
  const boundary = (k: number) => addPeriod(anchor, type, k);
  let k = Math.floor((now - anchor) / periodMs(type));
  while (boundary(k) > now) k--;
  while (boundary(k + 1) <= now) k++;
  // now is in [boundary(k), boundary(k + 1)).
  k += 1;
  if (estimated && k < 1) k = 1;
  return { at: boundary(k), previous: boundary(k - 1), estimated };
}
