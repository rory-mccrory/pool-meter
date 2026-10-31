import type { ImportPlan, ParseResult } from '../lib/importers';
import { fmtDollars, fmtTokens } from '../lib/format';
import { formatDateTime, toMs } from '../lib/time';

interface Props {
  result: ParseResult;
  plan: ImportPlan | null;
  accountName?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const FORMAT_LABEL = { 'ccusage-json': 'ccusage daily JSON', csv: 'CSV', backup: 'Pool Meter backup', unknown: 'Unknown' };
const PREVIEW_ROWS = 20;

/** Shows what was parsed and exactly what will change before anything is written. */
export function ImportPreview({ result, plan, accountName, onConfirm, onCancel }: Props) {
  const changes = plan ? plan.updates.length + plan.creates.length : 0;
  return (
    <section className="space-y-4" aria-label="Import preview">
      {result.error && (
        <div role="alert" className="rounded-lg border border-rose-300 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-200">
          <strong>Could not import.</strong> {result.error}
        </div>
      )}
      {result.warnings.length > 0 && (
        <details className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200" open={result.warnings.length <= 5}>
          <summary className="cursor-pointer font-medium">{result.warnings.length} warning{result.warnings.length === 1 ? '' : 's'}</summary>
          <ul className="mt-2 list-disc space-y-0.5 pl-5" aria-label="Import warnings">
            {result.warnings.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        </details>
      )}

      {result.ok && (
        <>
          <p className="text-sm">
            Detected <strong>{FORMAT_LABEL[result.format]}</strong> with <strong data-testid="row-count">{result.rows.length}</strong> usable row{result.rows.length === 1 ? '' : 's'}.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm" aria-label="Parsed rows">
              <thead className="muted text-xs">
                <tr>
                  <th className="py-1 pr-3 font-medium">Row</th>
                  <th className="py-1 pr-3 font-medium">When</th>
                  <th className="py-1 pr-3 text-right font-medium">Tokens</th>
                  <th className="py-1 pr-3 text-right font-medium">Cost</th>
                  <th className="py-1 text-right font-medium">Percent</th>
                </tr>
              </thead>
              <tbody>
                {result.rows.slice(0, PREVIEW_ROWS).map((r) => (
                  <tr key={r.line} className="border-t border-slate-200 dark:border-slate-800">
                    <td className="py-1 pr-3 tabular-nums">{r.line}</td>
                    <td className="py-1 pr-3">{r.label}</td>
                    <td className="py-1 pr-3 text-right tabular-nums">{fmtTokens(r.tokens)}</td>
                    <td className="py-1 pr-3 text-right tabular-nums">{fmtDollars(r.dollars)}</td>
                    <td className="py-1 text-right tabular-nums">{r.percent !== undefined ? `${r.percent}%` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {result.rows.length > PREVIEW_ROWS && <p className="muted mt-1 text-xs">…and {result.rows.length - PREVIEW_ROWS} more rows.</p>}
          </div>
        </>
      )}

      {plan && result.ok && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Changes to {accountName ?? 'account'}</h3>
          {plan.notes.map((n, i) => (
            <p key={i} className="text-sm text-amber-800 dark:text-amber-300">{n}</p>
          ))}
          {plan.updates.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm" aria-label="Reading updates">
                <thead className="muted text-xs">
                  <tr>
                    <th className="py-1 pr-3 font-medium">Reading</th>
                    <th className="py-1 pr-3 text-right font-medium">% used</th>
                    <th className="py-1 pr-3 text-right font-medium">Tokens</th>
                    <th className="py-1 text-right font-medium">Dollars</th>
                  </tr>
                </thead>
                <tbody>
                  {plan.updates.map((u) => (
                    <tr key={u.reading.id} className="border-t border-slate-200 dark:border-slate-800">
                      <td className="py-1 pr-3">
                        {formatDateTime(toMs(u.reading.at))}
                        {u.partial && <span className="ml-1 rounded bg-amber-100 px-1 text-[10px] text-amber-900 dark:bg-amber-900 dark:text-amber-100">partial</span>}
                      </td>
                      <td className="py-1 pr-3 text-right tabular-nums">{u.reading.percentUsed}%</td>
                      <td className="py-1 pr-3 text-right tabular-nums">
                        {u.tokens !== undefined ? `${u.reading.tokens !== undefined ? `${fmtTokens(u.reading.tokens)} → ` : ''}${fmtTokens(u.tokens)}` : '—'}
                      </td>
                      <td className="py-1 text-right tabular-nums">
                        {u.dollars !== undefined ? `${u.reading.dollars !== undefined ? `${fmtDollars(u.reading.dollars)} → ` : ''}${fmtDollars(u.dollars)}` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {plan.creates.length > 0 && <p className="text-sm">{plan.creates.length} new reading{plan.creates.length === 1 ? '' : 's'} from rows with a percent column.</p>}
          <p className="text-sm" data-testid="change-summary">
            {changes === 0 ? 'Nothing will change.' : `${plan.updates.length} reading${plan.updates.length === 1 ? '' : 's'} updated, ${plan.creates.length} added.`}
          </p>
        </div>
      )}

      <div className="flex gap-2">
        <button className="btn-primary" onClick={onConfirm} disabled={!result.ok || changes === 0}>Confirm import</button>
        <button className="btn-secondary" onClick={onCancel}>Cancel</button>
      </div>
    </section>
  );
}
