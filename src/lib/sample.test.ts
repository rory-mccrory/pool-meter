import { describe, expect, it } from 'vitest';
import { StoreSchema } from '../model';
import { detectSpikes } from './detectSpikes';
import { forecast } from './forecast';
import { rankAccounts } from './rankAccounts';
import { sampleStore } from './sample';

describe('sample data', () => {
  const now = Date.UTC(2026, 9, 31, 12, 17);
  const s = sampleStore(now);

  it('is a valid store', () => {
    expect(StoreSchema.safeParse(s).success).toBe(true);
  });

  it('shows all three statuses, a window reset, a pool fit and a spike', () => {
    const fs = s.accounts.map((a) => forecast(a, s.readings, now));
    expect(new Set(fs.map((f) => f.status))).toEqual(new Set(['safe', 'tight', 'dry']));
    const a = fs[0]!;
    expect(a.windowCount).toBe(2);
    expect(a.pools.dollars!.poolSize).toBeGreaterThan(900);
    expect(a.pools.dollars!.poolSize).toBeLessThan(1100);
    expect(a.pools.dollars!.confidence).toBe('high');
    expect(detectSpikes(s.readings.filter((r) => r.accountId === 'sample-claude-a')).spikes.length).toBeGreaterThan(0);
    const rank = rankAccounts(s.accounts.map((acct, i) => ({ account: acct, forecast: fs[i]! })));
    expect(rank.pick).not.toBeNull();
  });
});
