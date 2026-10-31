import { useState } from 'react';
import type { Reading } from '../model';
import type { Spike } from '../lib/detectSpikes';
import type { Forecast } from '../lib/forecast';
import { formatDateTime, HOUR_MS, toMs } from '../lib/time';
import { splitWindows } from '../lib/windows';

interface Props {
  readings: Reading[];
  forecast: Forecast;
  spikes: Spike[];
  now: number;
}

const W = 720;
const H = 280;
const PAD = { l: 40, r: 16, t: 16, b: 32 };

/**
 * Percent used over time: readings (current window solid, earlier windows faded),
 * the burn-rate projection, the reset line, "now", and shaded spike intervals.
 */
export function TimelineChart({ readings, forecast, spikes, now }: Props) {
  const [hover, setHover] = useState<Reading | null>(null);
  const windows = splitWindows(readings).slice(-2);
  const shown = windows.flatMap((w) => w.readings);
  if (shown.length === 0) {
    return <p className="muted py-10 text-center text-sm">No readings yet. Add one below to see the chart.</p>;
  }

  const { reset, exhaustionAt, lastAt, lastPercent, burn } = forecast;
  const projEnd =
    lastAt !== null && burn && reset
      ? Math.min(reset.at, exhaustionAt ?? Infinity)
      : null;
  const xs = [...shown.map((r) => toMs(r.at)), now, reset?.at ?? now];
  let x0 = Math.min(...xs);
  let x1 = Math.max(...xs);
  if (x1 - x0 < HOUR_MS) x1 = x0 + HOUR_MS;
  const span = x1 - x0;
  x0 -= span * 0.02;
  x1 += span * 0.02;

  const px = (t: number) => PAD.l + ((t - x0) / (x1 - x0)) * (W - PAD.l - PAD.r);
  const py = (p: number) => PAD.t + (1 - Math.min(p, 105) / 105) * (H - PAD.t - PAD.b);

  const xTicks = Array.from({ length: 5 }, (_, i) => x0 + ((x1 - x0) * (i + 0.5)) / 5);
  const currentIdx = windows.length - 1;

  const projection =
    projEnd !== null && lastAt !== null && lastPercent !== null && burn
      ? { x2: projEnd, y2: Math.min(100, lastPercent + burn.pctPerHour * ((projEnd - lastAt) / HOUR_MS)) }
      : null;

  const summary = `Percent used over time for ${shown.length} readings. ${
    forecast.exhaustionAt ? `Projected to reach 100% at ${formatDateTime(forecast.exhaustionAt)}.` : ''
  } ${reset ? `Resets ${formatDateTime(reset.at)}.` : ''}`;

  return (
    <figure className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={summary} data-testid="timeline-chart">
        {/* grid */}
        {[0, 25, 50, 75, 100].map((p) => (
          <g key={p}>
            <line x1={PAD.l} x2={W - PAD.r} y1={py(p)} y2={py(p)} className={p === 100 ? 'stroke-rose-400/70' : 'stroke-slate-200 dark:stroke-slate-800'} strokeWidth={1} strokeDasharray={p === 100 ? '4 3' : undefined} />
            <text x={PAD.l - 6} y={py(p) + 4} textAnchor="end" className="fill-slate-500 text-[11px] dark:fill-slate-400">{p}%</text>
          </g>
        ))}
        {xTicks.map((t) => (
          <text key={t} x={px(t)} y={H - 10} textAnchor="middle" className="fill-slate-500 text-[11px] dark:fill-slate-400">
            {new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
          </text>
        ))}

        {/* spikes */}
        {spikes
          .filter((s) => s.to >= x0)
          .map((s) => (
            <rect key={`${s.from}-${s.to}`} x={px(s.from)} width={Math.max(2, px(s.to) - px(s.from))} y={PAD.t} height={H - PAD.t - PAD.b} className="fill-rose-500/15">
              <title>{`Spike: ${s.deltaPercent.toFixed(1)} pts at ${s.rate.toFixed(2)}%/h (${s.ratio.toFixed(1)}x median)`}</title>
            </rect>
          ))}

        {/* reset & now */}
        {reset && (
          <g>
            <line x1={px(reset.at)} x2={px(reset.at)} y1={PAD.t} y2={H - PAD.b} className="stroke-teal-600 dark:stroke-teal-400" strokeWidth={2} />
            <text x={px(reset.at) - 4} y={H - PAD.b - 4} textAnchor="end" className="fill-slate-700 text-[11px] font-medium dark:fill-slate-200">
              Reset{reset.estimated ? ' (est.)' : ''}
            </text>
          </g>
        )}
        <line x1={px(now)} x2={px(now)} y1={PAD.t} y2={H - PAD.b} className="stroke-slate-400" strokeWidth={1} strokeDasharray="2 3" />
        <text x={px(now) + 4} y={H - PAD.b - 4} className="fill-slate-500 text-[11px] dark:fill-slate-400">now</text>

        {/* readings */}
        {windows.map((w, wi) => {
          const pts = w.readings.map((r) => `${px(toMs(r.at))},${py(r.percentUsed)}`).join(' ');
          const faded = wi !== currentIdx;
          return (
            <g key={w.index} opacity={faded ? 0.4 : 1}>
              <polyline points={pts} fill="none" className="stroke-slate-700 dark:stroke-slate-200" strokeWidth={2} strokeLinejoin="round" />
              {w.readings.map((r) => (
                <circle
                  key={r.id}
                  cx={px(toMs(r.at))}
                  cy={py(r.percentUsed)}
                  r={hover?.id === r.id ? 6 : 4}
                  className="fill-slate-700 stroke-white dark:fill-slate-200 dark:stroke-slate-900"
                  strokeWidth={2}
                />
              ))}
            </g>
          );
        })}

        {/* projection */}
        {projection && lastAt !== null && lastPercent !== null && (
          <g>
            <line x1={px(lastAt)} y1={py(lastPercent)} x2={px(projection.x2)} y2={py(projection.y2)} className={forecast.status === 'dry' ? 'stroke-rose-600' : forecast.status === 'tight' ? 'stroke-amber-600' : 'stroke-teal-600'} strokeWidth={2} strokeDasharray="6 4" />
            <text x={px(projection.x2) - 4} y={py(projection.y2) - 6} textAnchor="end" className="fill-slate-700 text-[11px] font-medium dark:fill-slate-200">
              {exhaustionAt !== null && reset && exhaustionAt < reset.at ? `100% at ${formatDateTime(exhaustionAt)}` : `${projection.y2.toFixed(0)}% at reset`}
            </text>
          </g>
        )}

        {/* hit targets */}
        {shown.map((r) => (
          <circle
            key={`hit-${r.id}`}
            cx={px(toMs(r.at))}
            cy={py(r.percentUsed)}
            r={12}
            fill="transparent"
            onMouseEnter={() => setHover(r)}
            onMouseLeave={() => setHover(null)}
          >
            <title>{`${formatDateTime(toMs(r.at))}: ${r.percentUsed}%`}</title>
          </circle>
        ))}
      </svg>
      {hover && (
        <div className="pointer-events-none absolute right-2 top-2 rounded-md border border-slate-200 bg-white/95 px-2 py-1 text-xs shadow dark:border-slate-700 dark:bg-slate-900/95">
          <div className="font-medium">{formatDateTime(toMs(hover.at))}</div>
          <div>{hover.percentUsed}% used{hover.tokens !== undefined ? ` · ${hover.tokens.toLocaleString()} tok` : ''}{hover.dollars !== undefined ? ` · $${hover.dollars}` : ''}</div>
          {hover.note && <div className="muted">{hover.note}</div>}
        </div>
      )}
      <figcaption className="muted mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs">
        <span>● readings (earlier window faded)</span>
        <span>- - projection at current burn</span>
        <span>│ reset</span>
        {spikes.length > 0 && <span><span className="inline-block h-2 w-3 bg-rose-500/30 align-middle" /> drain spike</span>}
      </figcaption>
    </figure>
  );
}
