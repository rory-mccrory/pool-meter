import { SPIKE_TAG_LABELS, SPIKE_TAGS, type SpikeTag, type SpikeTagKind } from '../model';
import { findTag, SPIKE_MULTIPLIER, tagTotals, type SpikeReport } from '../lib/detectSpikes';
import { formatDateTime } from '../lib/time';

interface Props {
  accountId: string;
  report: SpikeReport;
  tags: SpikeTag[];
  onTag: (from: number, to: number, tag: SpikeTagKind | null) => void;
}

export function SpikePanel({ accountId, report, tags, onTag }: Props) {
  if (report.intervalCount < 3) {
    return <p className="muted text-sm">Drain flags need at least 4 readings in a window.</p>;
  }
  const totals = tagTotals(report, tags, accountId).filter((t) => t.burn > 0);
  return (
    <div className="space-y-3">
      <p className="muted text-xs">
        Intervals burning more than {SPIKE_MULTIPLIER}x this account&apos;s median ({report.medianRate.toFixed(2)}%/h). Tag each one to see where your pool goes.
      </p>
      {report.spikes.length === 0 ? (
        <p className="text-sm">No drain spikes detected.</p>
      ) : (
        <ul className="divide-y divide-slate-200 text-sm dark:divide-slate-800" aria-label="Drain spikes">
          {report.spikes.map((s) => {
            const current = findTag(tags, accountId, s)?.tag ?? '';
            return (
              <li key={`${s.from}-${s.to}`} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <div>
                  <div className="font-medium tabular-nums">
                    {formatDateTime(s.from)} → {formatDateTime(s.to)}
                  </div>
                  <div className="muted text-xs tabular-nums">
                    {s.deltaPercent.toFixed(1)} pts at {s.rate.toFixed(2)}%/h · {s.ratio.toFixed(1)}x median
                  </div>
                </div>
                <label className="flex items-center gap-2 text-xs">
                  <span className="sr-only">Tag spike {formatDateTime(s.from)}</span>
                  <select
                    className="input w-auto py-1 text-xs"
                    value={current}
                    onChange={(e) => onTag(s.from, s.to, (e.target.value || null) as SpikeTagKind | null)}
                  >
                    <option value="">Untagged</option>
                    {SPIKE_TAGS.map((t) => (
                      <option key={t} value={t}>{SPIKE_TAG_LABELS[t]}</option>
                    ))}
                  </select>
                </label>
              </li>
            );
          })}
        </ul>
      )}
      {totals.length > 0 && (
        <div>
          <h4 className="mb-1 text-xs font-semibold">Spike burn as a share of all burn</h4>
          <ul className="space-y-1 text-xs" aria-label="Tag totals">
            {totals.map((t) => (
              <li key={t.tag} className="flex items-center gap-2">
                <span className="w-40 shrink-0">{t.tag === 'untagged' ? 'Untagged' : SPIKE_TAG_LABELS[t.tag]}</span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                  <span className="block h-full rounded-full bg-slate-600 dark:bg-slate-300" style={{ width: `${(t.share * 100).toFixed(1)}%` }} />
                </span>
                <span className="w-24 text-right tabular-nums">{(t.share * 100).toFixed(1)}% ({t.burn.toFixed(1)} pts)</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
