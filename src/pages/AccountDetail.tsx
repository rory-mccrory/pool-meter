import { useMemo, useState } from 'react';
import { AccountForm } from '../components/AccountForm';
import { CalibrationChart } from '../components/CalibrationChart';
import { ReadingForm } from '../components/ReadingForm';
import { ReadingsTable } from '../components/ReadingsTable';
import { SpikePanel } from '../components/SpikePanel';
import { StatusBadge } from '../components/StatusBadge';
import { TimelineChart } from '../components/TimelineChart';
import { WINDOW_LABELS, type Reading } from '../model';
import { detectSpikes } from '../lib/detectSpikes';
import type { PoolFit, PoolUnit } from '../lib/fitPool';
import { forecast } from '../lib/forecast';
import { fmtPct, fmtUnit } from '../lib/format';
import { formatDateTime, formatDuration, toMs } from '../lib/time';
import { RESET_DROP_POINTS, sortReadings } from '../lib/windows';
import { href, navigate } from '../router';
import { useStore } from '../state';

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <div className="muted text-xs">{label}</div>
      <div className="text-lg font-semibold tabular-nums">{value}</div>
      {sub && <div className="muted text-xs">{sub}</div>}
    </div>
  );
}

const CONF_STYLE = {
  low: 'text-rose-700 dark:text-rose-400',
  medium: 'text-amber-700 dark:text-amber-400',
  high: 'text-emerald-700 dark:text-emerald-400',
};

function PoolPanel({ fits, burnPct }: { fits: Partial<Record<PoolUnit, PoolFit | null>>; burnPct: number | null }) {
  const available = (['dollars', 'tokens'] as const).filter((u) => fits[u]);
  const [unit, setUnit] = useState<PoolUnit | undefined>(available[0]);
  const fit = unit ? fits[unit] : null;
  if (!fit) {
    return (
      <div className="space-y-1 text-sm">
        <p>No token or dollar readings yet, so the pool size is unknown.</p>
        <p className="muted text-xs">
          Burn is estimated in percent per hour{burnPct !== null ? ` (${burnPct.toFixed(2)}%/h)` : ''}. Add tokens or dollars to readings, or import ccusage data, to calibrate the hidden pool.
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {available.length > 1 && (
        <div className="flex gap-1" role="group" aria-label="Pool unit">
          {available.map((u) => (
            <button key={u} className={u === unit ? 'btn-primary px-2 py-0.5 text-xs' : 'btn-secondary px-2 py-0.5 text-xs'} onClick={() => setUnit(u)} aria-pressed={u === unit}>
              {u}
            </button>
          ))}
        </div>
      )}
      <p className="text-sm" data-testid="pool-estimate">
        Estimated pool: <strong>{fmtUnit(fit.poolSize, fit.unit)}</strong>{' '}
        <span className={`text-xs font-semibold ${CONF_STYLE[fit.confidence]}`}>({fit.confidence} confidence)</span>
      </p>
      <p className="muted text-xs">{fit.reason} 1% ≈ {fmtUnit(fit.unitsPerPercent, fit.unit)}.{burnPct !== null && ` Burn ≈ ${fmtUnit((burnPct * fit.poolSize) / 100, fit.unit)}/h.`}</p>
      <CalibrationChart fit={fit} />
    </div>
  );
}

export function AccountDetail({ id }: { id: string }) {
  const { store, dispatch, now } = useStore();
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [notice, setNotice] = useState<string>();
  const account = store.accounts.find((a) => a.id === id);
  const readings = useMemo(() => sortReadings(store.readings.filter((r) => r.accountId === id)), [store.readings, id]);
  const f = useMemo(() => (account ? forecast(account, store.readings, now) : null), [account, store.readings, now]);
  const spikes = useMemo(() => detectSpikes(readings), [readings]);

  if (!account || !f) {
    return (
      <div className="card">
        <p>Account not found.</p>
        <a className="link" href={href({ page: 'dashboard' })}>Back to dashboard</a>
      </div>
    );
  }

  function addReading(r: Reading) {
    const before = readings.filter((x) => toMs(x.at) <= toMs(r.at)).pop();
    dispatch({ type: 'addReading', reading: r });
    setNotice(
      before && before.percentUsed - r.percentUsed > RESET_DROP_POINTS
        ? `Reading added. Percent dropped ${(before.percentUsed - r.percentUsed).toFixed(0)} points, so a new window started.`
        : 'Reading added.',
    );
  }

  const exhaustionText =
    f.exhaustionAt === null
      ? f.burn ? 'Not at this rate' : '—'
      : f.reset && f.exhaustionAt >= f.reset.at
        ? 'After reset'
        : formatDateTime(f.exhaustionAt);

  return (
    <section className="space-y-4">
      <a className="link text-sm" href={href({ page: 'dashboard' })}>← Dashboard</a>
      <div className="card space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h1 className="text-xl font-semibold">{account.name}</h1>
            <p className="muted text-sm">
              {[account.provider, account.plan, WINDOW_LABELS[account.windowType]].filter(Boolean).join(' · ')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={f.status} />
            <button className="btn-secondary px-2 py-1 text-xs" onClick={() => setEditing((v) => !v)}>{editing ? 'Close' : 'Edit account'}</button>
          </div>
        </div>
        {editing && (
          <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
            <AccountForm initial={account} onSave={(a) => { dispatch({ type: 'updateAccount', account: a }); setEditing(false); }} onCancel={() => setEditing(false)} />
            <div className="mt-3 border-t border-slate-200 pt-3 dark:border-slate-800">
              {confirmDelete ? (
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span>Delete {account.name} and its {readings.length} readings?</span>
                  <button className="btn-danger" onClick={() => { dispatch({ type: 'deleteAccount', id: account.id }); navigate({ page: 'dashboard' }); }}>Delete account</button>
                  <button className="btn-secondary" onClick={() => setConfirmDelete(false)}>Cancel</button>
                </div>
              ) : (
                <button className="btn-secondary text-rose-700 dark:text-rose-400" onClick={() => setConfirmDelete(true)}>Delete account…</button>
              )}
            </div>
          </div>
        )}
        <p className="text-sm" data-testid="forecast-message">{f.message}</p>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4" data-testid="forecast">
          <Stat label="Used now (est.)" value={fmtPct(f.percentNow)} sub={f.lastPercent !== null ? `last reading ${fmtPct(f.lastPercent)}` : undefined} />
          <Stat label="Burn rate" value={f.burn ? `${f.burn.pctPerHour.toFixed(2)}%/h` : '—'} sub={f.burn ? (f.burn.method === 'weighted' ? `weighted over ${f.burn.samples} intervals` : 'since window start') : undefined} />
          <Stat label="Projected exhaustion" value={exhaustionText} sub={f.projectedAtReset !== null ? `${Math.min(999, f.projectedAtReset).toFixed(0)}% at reset` : undefined} />
          <Stat label="Time to reset" value={f.reset ? formatDuration(f.reset.at - now) : '—'} sub={f.reset ? `${formatDateTime(f.reset.at)}${f.reset.estimated ? ' (estimated)' : ''}` : 'set a reset time or add a reading'} />
        </div>
        <TimelineChart readings={readings} forecast={f} spikes={spikes.spikes} now={now} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card space-y-2">
          <h2 className="font-semibold">Pool estimate</h2>
          <PoolPanel key={account.id} fits={f.pools} burnPct={f.burn?.pctPerHour ?? null} />
        </div>
        <div className="card space-y-2">
          <h2 className="font-semibold">Drain flags</h2>
          <SpikePanel
            accountId={account.id}
            report={spikes}
            tags={store.tags}
            onTag={(from, to, tag) =>
              dispatch({ type: 'setTag', accountId: account.id, from: new Date(from).toISOString(), to: new Date(to).toISOString(), tag })
            }
          />
        </div>
      </div>

      <div className="card space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">Add reading</h2>
          <a className="link text-sm" href={href({ page: 'import', accountId: account.id })}>Import ccusage / CSV →</a>
        </div>
        <ReadingForm accountId={account.id} now={now} onSubmit={addReading} />
        {notice && <p role="status" className="text-sm text-teal-800 dark:text-teal-300">{notice}</p>}
      </div>

      <div className="card space-y-2">
        <h2 className="font-semibold">Readings ({readings.length})</h2>
        <ReadingsTable
          readings={readings}
          now={now}
          onUpdate={(r) => dispatch({ type: 'updateReading', reading: r })}
          onDelete={(rid) => dispatch({ type: 'deleteReading', id: rid })}
        />
      </div>
    </section>
  );
}
