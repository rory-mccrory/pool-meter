import type { Account, Reading } from '../model';
import { burnRate, type BurnRate } from './burnRate';
import { fitPool, type PoolFit } from './fitPool';
import { HOUR_MS, toMs } from './time';
import { nextReset, splitWindows, type ResetInfo } from './windows';

export type Status = 'safe' | 'tight' | 'dry' | 'unknown';

export const STATUS_LABELS: Record<Status, string> = {
  safe: 'Safe',
  tight: 'Tight',
  dry: 'Will run dry before reset',
  unknown: 'Not enough data',
};

/** Projected usage at reset at or above this percent is labelled tight. */
export const TIGHT_THRESHOLD = 85;

export interface Forecast {
  accountId: string;
  status: Status;
  message: string;
  /** Last reading in the current window, if any. */
  lastAt: number | null;
  lastPercent: number | null;
  /** Percent extrapolated to `now`, capped at 100. */
  percentNow: number | null;
  burn: BurnRate | null;
  reset: ResetInfo | null;
  hoursToReset: number | null;
  /** When percent is projected to hit 100. Null when burn is zero or unknown. */
  exhaustionAt: number | null;
  projectedAtReset: number | null;
  /** Percent per hour you can still spend and land exactly at 100 % at reset. */
  headroomPerHour: number | null;
  /** True when a reset boundary passed after the last reading. */
  windowReset: boolean;
  windowCount: number;
  currentWindow: Reading[];
  pools: { tokens: PoolFit | null; dollars: PoolFit | null };
}

/** Configured reset boundary at or before the window's first reading (fixed windows only). */
function windowStartFor(account: Account, firstAt: number, reset: ResetInfo | null): number | undefined {
  if (!reset || reset.estimated || account.windowType === 'weekly-rolling') return undefined;
  return nextReset(account, undefined, firstAt)?.previous;
}

/**
 * Forecast for one account at time `now`: current window, weighted burn rate,
 * projected exhaustion, time to reset and a safe / tight / dry status.
 */
export function forecast(account: Account, allReadings: readonly Reading[], now: number): Forecast {
  const readings = allReadings.filter((r) => r.accountId === account.id);
  const windows = splitWindows(readings);
  const current = windows[windows.length - 1]?.readings ?? [];
  const first = current[0];
  const last = current[current.length - 1];
  const pools = { tokens: fitPool(readings, 'tokens'), dollars: fitPool(readings, 'dollars') };

  const base: Forecast = {
    accountId: account.id,
    status: 'unknown',
    message: 'Add a reading to start forecasting.',
    lastAt: null,
    lastPercent: null,
    percentNow: null,
    burn: null,
    reset: null,
    hoursToReset: null,
    exhaustionAt: null,
    projectedAtReset: null,
    headroomPerHour: null,
    windowReset: false,
    windowCount: windows.length,
    currentWindow: current,
    pools,
  };

  const reset = nextReset(account, first ? toMs(first.at) : undefined, now);
  base.reset = reset;
  if (reset) base.hoursToReset = Math.max(0, (reset.at - now) / HOUR_MS);
  if (!first || !last || !reset) return base;

  const burn = burnRate(current, windowStartFor(account, toMs(first.at), reset));
  base.burn = burn;

  let lastAt = toMs(last.at);
  let lastPercent = last.percentUsed;
  if (lastAt < reset.previous) {
    // A reset boundary passed since the last reading: start the new period at 0 %.
    base.windowReset = true;
    lastAt = reset.previous;
    lastPercent = 0;
  }
  base.lastAt = lastAt;
  base.lastPercent = lastPercent;

  const rate = burn?.pctPerHour ?? null;
  const elapsedH = Math.max(0, (now - lastAt) / HOUR_MS);
  const percentNow = Math.min(100, lastPercent + (rate ?? 0) * elapsedH);
  base.percentNow = percentNow;
  const hoursToReset = base.hoursToReset ?? 0;
  base.headroomPerHour = hoursToReset > 0 ? Math.max(0, 100 - percentNow) / hoursToReset : null;

  if (lastPercent >= 100) {
    base.exhaustionAt = lastAt;
  } else if (rate !== null && rate > 0) {
    base.exhaustionAt = lastAt + ((100 - lastPercent) / rate) * HOUR_MS;
  }

  if (rate === null) {
    base.status = lastPercent >= 100 ? 'dry' : 'unknown';
    base.message =
      lastPercent >= 100
        ? 'Pool is exhausted until reset.'
        : base.windowReset
          ? 'Window has reset since the last reading. Add a reading.'
          : 'Add a second reading to measure burn rate.';
    return base;
  }

  const projectedAtReset = lastPercent + rate * ((reset.at - lastAt) / HOUR_MS);
  base.projectedAtReset = projectedAtReset;
  if (base.exhaustionAt !== null && base.exhaustionAt < reset.at) {
    base.status = 'dry';
    base.message = `At ${rate.toFixed(2)}%/h the pool runs out before reset.`;
  } else if (projectedAtReset >= TIGHT_THRESHOLD) {
    base.status = 'tight';
    base.message = `Projected ${projectedAtReset.toFixed(0)}% used at reset.`;
  } else {
    base.status = 'safe';
    base.message =
      rate === 0 ? 'No burn measured in this window.' : `Projected ${projectedAtReset.toFixed(0)}% used at reset.`;
  }
  if (base.windowReset) base.message = `Window reset since last reading; using last window's burn. ${base.message}`;
  return base;
}
