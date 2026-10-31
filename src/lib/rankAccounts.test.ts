import { describe, expect, it } from 'vitest';
import { account, H, reading, T0 } from '../test/factories';
import { forecast } from './forecast';
import { rankAccounts } from './rankAccounts';

const now = T0 + 10 * H;
function item(id: string, resetHours: number, readings: ReturnType<typeof reading>[]) {
  const a = account({ id, name: id, resetAt: new Date(T0 + resetHours * H).toISOString() });
  const rs = readings.map((r) => ({ ...r, accountId: id }));
  return { account: a, forecast: forecast(a, rs, now) };
}

describe('rankAccounts', () => {
  it('handles no accounts', () => {
    const r = rankAccounts([]);
    expect(r.pick).toBeNull();
    expect(r.summary).toMatch(/Add an account/);
  });

  it('picks the account with most headroom per hour', () => {
    const busy = item('busy', 40, [reading(0, 60), reading(10, 80)]); // 20% left / 30h
    const idle = item('idle', 110, [reading(0, 10), reading(10, 20)]); // 80% / 100h
    const soon = item('soon', 12, [reading(0, 40), reading(10, 50)]); // 50% / 2h -> 25%/h
    const r = rankAccounts([busy, idle, soon]);
    expect(r.ranked.map((x) => x.account.id)).toEqual(['soon', 'idle', 'busy']);
    expect(r.pick!.account.id).toBe('soon');
    expect(r.summary).toMatch(/Send the next job to soon/);
    expect(r.ranked[0]!.reason).toMatch(/50% left/);
  });

  it('sinks exhausted and empty accounts', () => {
    const done = item('done', 40, [reading(0, 100)]);
    const empty = item('empty', 40, []);
    const ok = item('ok', 40, [reading(0, 10), reading(10, 20)]);
    const r = rankAccounts([done, empty, ok]);
    expect(r.ranked[0]!.account.id).toBe('ok');
    expect(r.ranked.find((x) => x.account.id === 'done')!.reason).toMatch(/Exhausted/);
    expect(r.ranked.find((x) => x.account.id === 'empty')!.reason).toMatch(/No readings/);
  });

  it('compares dollars when every account has a confident dollar pool', () => {
    const mk = (id: string, pool: number) =>
      item(id, 60, [10, 20, 40, 60, 70].map((p, i) => reading(i * 2, p, { dollars: (p / 100) * pool })));
    // same percent picture, but "big" has a 10x larger pool
    const r = rankAccounts([mk('small', 100), mk('big', 1000)]);
    expect(r.basis).toBe('dollars');
    expect(r.pick!.account.id).toBe('big');
  });

  it('says when every account will run dry', () => {
    const a = item('a', 100, [reading(0, 10), reading(10, 40)]);
    const r = rankAccounts([a]);
    expect(a.forecast.status).toBe('dry');
    expect(r.summary).toMatch(/every account is on track to run dry/);
  });
});
