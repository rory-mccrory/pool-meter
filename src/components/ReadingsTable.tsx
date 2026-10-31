import { useState } from 'react';
import type { Reading } from '../model';
import { fmtDollars, fmtTokens } from '../lib/format';
import { formatDateTime, toMs } from '../lib/time';
import { splitWindows } from '../lib/windows';
import { ReadingForm } from './ReadingForm';

interface Props {
  readings: Reading[];
  now: number;
  onUpdate: (r: Reading) => void;
  onDelete: (id: string) => void;
}

export function ReadingsTable({ readings, now, onUpdate, onDelete }: Props) {
  const [editing, setEditing] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const windows = splitWindows(readings);
  const rows = windows.flatMap((w) => w.readings.map((r) => ({ r, w: w.index + 1 }))).reverse();
  if (rows.length === 0) return <p className="muted text-sm">No readings yet.</p>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm" aria-label="Readings">
        <thead className="muted text-xs">
          <tr>
            <th className="py-1 pr-3 font-medium">Time</th>
            <th className="py-1 pr-3 font-medium">Window</th>
            <th className="py-1 pr-3 text-right font-medium">% used</th>
            <th className="py-1 pr-3 text-right font-medium">Tokens</th>
            <th className="py-1 pr-3 text-right font-medium">Dollars</th>
            <th className="py-1 pr-3 font-medium">Note</th>
            <th className="py-1 font-medium"><span className="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ r, w }, i) =>
            editing === r.id ? (
              <tr key={r.id} className="border-t border-slate-200 dark:border-slate-800">
                <td colSpan={7} className="py-2">
                  <ReadingForm
                    accountId={r.accountId}
                    now={now}
                    initial={r}
                    onSubmit={(nr) => {
                      onUpdate(nr);
                      setEditing(null);
                    }}
                    onCancel={() => setEditing(null)}
                  />
                </td>
              </tr>
            ) : (
              <tr key={r.id} className="border-t border-slate-200 dark:border-slate-800">
                <td className="py-1.5 pr-3 tabular-nums">{formatDateTime(toMs(r.at))}</td>
                <td className="py-1.5 pr-3">
                  {w}
                  {rows[i + 1] && rows[i + 1]!.w !== w && (
                    <span className="ml-1 rounded bg-teal-100 px-1 text-[10px] text-teal-800 dark:bg-teal-900 dark:text-teal-200">new window</span>
                  )}
                </td>
                <td className="py-1.5 pr-3 text-right tabular-nums">{r.percentUsed}%</td>
                <td className="py-1.5 pr-3 text-right tabular-nums">{r.tokens !== undefined ? fmtTokens(r.tokens) : '—'}</td>
                <td className="py-1.5 pr-3 text-right tabular-nums">{r.dollars !== undefined ? fmtDollars(r.dollars) : '—'}</td>
                <td className="muted max-w-[16rem] truncate py-1.5 pr-3">{r.note}</td>
                <td className="whitespace-nowrap py-1.5 text-right">
                  {confirming === r.id ? (
                    <>
                      <button className="btn-danger mr-1 px-2 py-0.5 text-xs" onClick={() => { onDelete(r.id); setConfirming(null); }}>Confirm delete</button>
                      <button className="btn-secondary px-2 py-0.5 text-xs" onClick={() => setConfirming(null)}>Keep</button>
                    </>
                  ) : (
                    <>
                      <button className="btn-secondary mr-1 px-2 py-0.5 text-xs" onClick={() => setEditing(r.id)} aria-label={`Edit reading ${formatDateTime(toMs(r.at))}`}>Edit</button>
                      <button className="btn-secondary px-2 py-0.5 text-xs" onClick={() => setConfirming(r.id)} aria-label={`Delete reading ${formatDateTime(toMs(r.at))}`}>Delete</button>
                    </>
                  )}
                </td>
              </tr>
            ),
          )}
        </tbody>
      </table>
    </div>
  );
}
