import { useMemo, useState } from 'react';
import { AccountForm } from '../components/AccountForm';
import { STATUS_BAR, StatusBadge } from '../components/StatusBadge';
import { WINDOW_LABELS } from '../model';
import { forecast } from '../lib/forecast';
import { fmtPct, fmtUnit } from '../lib/format';
import { rankAccounts, type RankedAccount } from '../lib/rankAccounts';
import { sampleStore } from '../lib/sample';
import { formatDateTime, formatDuration } from '../lib/time';
import { href } from '../router';
import { useStore } from '../state';

function AccountCard({ item, isPick, now }: { item: RankedAccount; isPick: boolean; now: number }) {
  const { account, forecast: f } = item;
  const pool = f.pools.dollars ?? f.pools.tokens;
  const unitBurn = pool && f.burn ? (f.burn.pctPerHour * pool.poolSize) / 100 : null;
  return (
    <article className={`card flex flex-col gap-3 ${isPick ? 'ring-2 ring-teal-600' : ''}`} data-testid="account-card" aria-label={account.name}>
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="truncate text-base font-semibold">
            <a className="hover:underline" href={href({ page: 'account', id: account.id })}>{account.name}</a>
          </h2>
          <p className="muted truncate text-xs">
            {[account.provider, account.plan, WINDOW_LABELS[account.windowType]].filter(Boolean).join(' · ')}
          </p>
        </div>
        <StatusBadge status={f.status} />
      </header>

      <div>
        <div className="flex items-baseline justify-between">
          <span className="text-3xl font-semibold tabular-nums">{fmtPct(f.percentNow)}</span>
          <span className="muted text-xs">used now (est.)</span>
        </div>
        <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
          <div className={`h-full rounded-full ${STATUS_BAR[f.status]}`} style={{ width: `${Math.min(100, f.percentNow ?? 0)}%` }} />
        </div>
      </div>

      <dl className="grid grid-cols-3 gap-2 text-sm">
        <div>
          <dt className="muted text-xs">Runs dry</dt>
          <dd className="font-medium tabular-nums" data-testid="eta">
            {f.exhaustionAt === null ? (f.burn ? 'Not at this rate' : '—') : f.reset && f.exhaustionAt >= f.reset.at ? 'After reset' : formatDateTime(f.exhaustionAt)}
          </dd>
        </div>
        <div>
          <dt className="muted text-xs">Reset in</dt>
          <dd className="font-medium tabular-nums">
            {f.reset ? formatDuration(f.reset.at - now) : '—'}
            {f.reset?.estimated && <span className="muted text-xs"> est.</span>}
          </dd>
        </div>
        <div>
          <dt className="muted text-xs">Burn</dt>
          <dd className="font-medium tabular-nums">
            {f.burn ? `${f.burn.pctPerHour.toFixed(2)}%/h` : '—'}
            {unitBurn !== null && pool && <span className="muted block text-xs">{fmtUnit(unitBurn, pool.unit)}/h</span>}
          </dd>
        </div>
      </dl>

      <p className="text-xs">
        <span className="font-medium">#{item.rank} for next job.</span> <span className="muted">{item.reason}</span>
      </p>
      <p className="muted text-xs">{f.message}</p>
      <div className="mt-auto flex gap-2">
        <a className="btn-secondary" href={href({ page: 'account', id: account.id })}>Details &amp; readings</a>
      </div>
    </article>
  );
}

export function Dashboard() {
  const { store, dispatch, now } = useStore();
  const [adding, setAdding] = useState(false);

  const ranking = useMemo(
    () => rankAccounts(store.accounts.map((a) => ({ account: a, forecast: forecast(a, store.readings, now) }))),
    [store, now],
  );

  if (store.accounts.length === 0) {
    return (
      <section className="mx-auto max-w-2xl space-y-6 py-8">
        <div className="card space-y-3 text-center">
          <h1 className="text-xl font-semibold">Know when each AI plan will run dry</h1>
          <p className="muted text-sm">
            Log the percent-used number from your provider dashboards. Pool Meter fits the hidden pool size, forecasts
            exhaustion against the reset, flags drain spikes and tells you which account should take the next job.
            Everything stays in this browser.
          </p>
          <div className="flex flex-wrap justify-center gap-2 pt-2">
            <button className="btn-primary" onClick={() => dispatch({ type: 'replace', store: sampleStore(Date.now()) })}>
              Load sample data
            </button>
            <button className="btn-secondary" onClick={() => setAdding(true)}>Add your first account</button>
          </div>
        </div>
        {adding && (
          <div className="card">
            <AccountForm
              onSave={(a) => {
                dispatch({ type: 'addAccount', account: a });
                window.location.hash = href({ page: 'account', id: a.id });
              }}
              onCancel={() => setAdding(false)}
            />
          </div>
        )}
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="card flex flex-col gap-1 border-teal-600/40 bg-teal-50 dark:bg-teal-950/40" data-testid="pacing">
        <h1 className="text-sm font-semibold uppercase tracking-wide text-teal-800 dark:text-teal-300">Next job</h1>
        <p className="text-sm">{ranking.summary}</p>
        {ranking.basis !== 'percent' && (
          <p className="muted text-xs">Compared in {ranking.basis} per hour because every account has a calibrated pool.</p>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {ranking.ranked.map((item) => (
          <AccountCard key={item.account.id} item={item} isPick={ranking.pick?.account.id === item.account.id} now={now} />
        ))}
      </div>

      <div className="card">
        {adding ? (
          <AccountForm
            onSave={(a) => {
              dispatch({ type: 'addAccount', account: a });
              setAdding(false);
            }}
            onCancel={() => setAdding(false)}
          />
        ) : (
          <button className="btn-secondary" onClick={() => setAdding(true)}>+ Add account</button>
        )}
      </div>
      <p className="muted text-xs">Times are estimates from your readings.</p>
    </section>
  );
}
