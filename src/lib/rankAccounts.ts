import type { Account } from '../model';
import type { PoolUnit } from './fitPool';
import type { Forecast } from './forecast';
import { formatDuration, HOUR_MS } from './time';

export interface RankedAccount {
  account: Account;
  forecast: Forecast;
  /** Headroom per hour in the comparison unit (percent, tokens or dollars). */
  score: number | null;
  rank: number;
  reason: string;
}

export interface Ranking {
  ranked: RankedAccount[];
  /** Account that should take the next job, or null when none can. */
  pick: RankedAccount | null;
  /** Unit used to compare headroom across accounts. */
  basis: 'percent' | PoolUnit;
  summary: string;
}

function fmtUnits(v: number, basis: Ranking['basis']): string {
  if (basis === 'dollars') return `$${v.toFixed(2)}`;
  if (basis === 'tokens') return v >= 1e6 ? `${(v / 1e6).toFixed(2)}M tok` : `${Math.round(v / 1e3)}k tok`;
  return `${v.toFixed(2)}%`;
}

/**
 * Picks a common basis: when every forecastable account has a medium/high-confidence
 * pool estimate in the same unit, compare absolute units (dollars preferred), because
 * one percent of a large plan is worth more than one percent of a small one. Otherwise
 * compare percent.
 */
function chooseBasis(items: { forecast: Forecast }[]): Ranking['basis'] {
  const usable = items.filter((i) => i.forecast.headroomPerHour !== null);
  if (usable.length < 2) return 'percent';
  for (const unit of ['dollars', 'tokens'] as const) {
    if (usable.every((i) => i.forecast.pools[unit] && i.forecast.pools[unit]!.confidence !== 'low')) return unit;
  }
  return 'percent';
}

/**
 * Ranks accounts by headroom per hour until reset (what you can still spend per hour
 * without running out before the window resets). Exhausted accounts and accounts with
 * no readings sink to the bottom. The top eligible account takes the next job.
 */
export function rankAccounts(items: { account: Account; forecast: Forecast }[]): Ranking {
  const basis = chooseBasis(items);
  const scored = items.map(({ account, forecast }) => {
    let score: number | null = null;
    if (forecast.headroomPerHour !== null && (forecast.percentNow ?? 0) < 100) {
      score = forecast.headroomPerHour;
      if (basis !== 'percent') score = (score * forecast.pools[basis]!.poolSize) / 100;
    }
    return { account, forecast, score };
  });
  scored.sort((a, b) => (b.score ?? -Infinity) - (a.score ?? -Infinity) || a.account.name.localeCompare(b.account.name));

  const ranked: RankedAccount[] = scored.map((s, i) => {
    const f = s.forecast;
    let reason: string;
    if (s.score === null) {
      reason =
        (f.percentNow ?? 0) >= 100
          ? `Exhausted; resets in ${formatDuration((f.hoursToReset ?? 0) * HOUR_MS)}.`
          : 'No readings yet, cannot pace.';
    } else {
      const left = 100 - (f.percentNow ?? 0);
      const burn = f.burn ? `${f.burn.pctPerHour.toFixed(2)}%/h burn` : 'burn unknown';
      reason = `${left.toFixed(0)}% left with ${formatDuration((f.hoursToReset ?? 0) * HOUR_MS)} to reset: ${fmtUnits(s.score, basis)}/h headroom vs ${burn}.`;
    }
    return { ...s, rank: i + 1, reason };
  });

  const pick = ranked.find((r) => r.score !== null && r.score > 0) ?? null;
  let summary: string;
  if (!pick) {
    summary = items.length ? 'No account has headroom right now.' : 'Add an account to get a recommendation.';
  } else if (ranked.filter((r) => r.score !== null).every((r) => r.forecast.status === 'dry')) {
    summary = `${pick.account.name} has the most headroom, but every account is on track to run dry. ${pick.reason}`;
  } else {
    const runnerUp = ranked.find((r) => r !== pick && r.score !== null);
    const vs = runnerUp && runnerUp.score! > 0 ? ` (${(pick.score! / runnerUp.score!).toFixed(1)}x ${runnerUp.account.name})` : '';
    summary = `Send the next job to ${pick.account.name}: most headroom per hour until reset${vs}. ${pick.reason}`;
  }
  return { ranked, pick, basis, summary };
}
