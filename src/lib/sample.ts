import type { Account, Reading, SpikeTag, Store } from '../model';
import { STORE_VERSION } from '../model';
import { DAY_MS, HOUR_MS } from './time';

/**
 * Deterministic demo data relative to `now`: three accounts that land in the
 * three statuses, one with a previous window (auto-reset), token/dollar readings
 * for pool calibration and a spike to tag.
 */
export function sampleStore(now: number): Store {
  const iso = (ms: number) => new Date(ms).toISOString();
  const hourFloor = Math.floor(now / HOUR_MS) * HOUR_MS;

  const accounts: Account[] = [
    {
      id: 'sample-claude-a',
      name: 'Claude Max A',
      provider: 'Anthropic',
      plan: 'Max 20x',
      windowType: 'weekly-fixed',
      resetAt: iso(hourFloor + 52 * HOUR_MS),
      createdAt: iso(now - 14 * DAY_MS),
    },
    {
      id: 'sample-claude-b',
      name: 'Claude Max B',
      provider: 'Anthropic',
      plan: 'Max 5x',
      windowType: 'weekly-rolling',
      createdAt: iso(now - 10 * DAY_MS),
    },
    {
      id: 'sample-codex',
      name: 'Codex Pro',
      provider: 'OpenAI',
      plan: 'Pro',
      windowType: 'weekly-fixed',
      resetAt: iso(hourFloor + 70 * HOUR_MS),
      createdAt: iso(now - 9 * DAY_MS),
    },
  ];

  const readings: Reading[] = [];
  const add = (accountId: string, hoursAgo: number, percentUsed: number, extra: Partial<Reading> = {}) =>
    readings.push({
      id: `${accountId}-r${readings.length}`,
      accountId,
      at: iso(hourFloor - hoursAgo * HOUR_MS),
      percentUsed,
      ...extra,
    });

  // Claude Max A: pool of ~$1,000 / 60M tokens. Previous window then a reset 116h ago.
  const POOL_DOLLARS = 1000;
  const POOL_TOKENS = 60_000_000;
  const noise = [1.02, 0.97, 1.01, 0.99, 1.03, 0.98, 1.0, 1.01, 0.99];
  const aPrev: [number, number][] = [[150, 70], [140, 81], [128, 92]];
  for (const [h, p] of aPrev) add('sample-claude-a', h, p);
  const aCur: [number, number][] = [
    [110, 6], [96, 13], [80, 21], [62, 29], [50, 33], [44, 47], [30, 52], [14, 58], [2, 63],
  ];
  aCur.forEach(([h, p], i) =>
    add('sample-claude-a', h, p, {
      dollars: Math.round(((p / 100) * POOL_DOLLARS * noise[i]!) * 100) / 100,
      tokens: Math.round((p / 100) * POOL_TOKENS * noise[(i + 3) % noise.length]!),
      note: h === 44 ? 'Parallel agent team run' : undefined,
    }),
  );

  // Claude Max B: percent only, light use.
  const b: [number, number][] = [[100, 8], [76, 12], [52, 15], [30, 19], [8, 22]];
  for (const [h, p] of b) add('sample-claude-b', h, p);

  // Codex Pro: fast burn, will run dry before reset.
  const c: [number, number][] = [[40, 30], [30, 41], [20, 52], [10, 62], [1, 71]];
  for (const [h, p] of c) add('sample-codex', h, p, { dollars: Math.round(p * 2 * 100) / 100 });

  const tags: SpikeTag[] = [];
  return { version: STORE_VERSION, accounts, readings, tags };
}
