import type { PoolFit } from '../lib/fitPool';
import { fmtUnit } from '../lib/format';

const W = 360;
const H = 220;
const PAD = { l: 52, r: 12, t: 12, b: 30 };

/** Units vs percent scatter with the least-squares line through the origin. */
export function CalibrationChart({ fit }: { fit: PoolFit }) {
  const maxY = Math.max(fit.poolSize, ...fit.points.map((p) => p.units)) * 1.05;
  const px = (p: number) => PAD.l + (p / 100) * (W - PAD.l - PAD.r);
  const py = (u: number) => PAD.t + (1 - u / maxY) * (H - PAD.t - PAD.b);
  const yTicks = [0, 0.5, 1].map((f) => f * fit.poolSize);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" data-testid="calibration-chart"
      aria-label={`Calibration: ${fit.n} readings of ${fit.unit} against percent; fitted pool ${fmtUnit(fit.poolSize, fit.unit)}.`}>
      {yTicks.map((u) => (
        <g key={u}>
          <line x1={PAD.l} x2={W - PAD.r} y1={py(u)} y2={py(u)} className="stroke-slate-200 dark:stroke-slate-800" />
          <text x={PAD.l - 6} y={py(u) + 4} textAnchor="end" className="fill-slate-500 text-[10px] dark:fill-slate-400">
            {fmtUnit(u, fit.unit).replace(' tokens', '')}
          </text>
        </g>
      ))}
      {[0, 50, 100].map((p) => (
        <text key={p} x={px(p)} y={H - 10} textAnchor="middle" className="fill-slate-500 text-[10px] dark:fill-slate-400">{p}%</text>
      ))}
      <line x1={px(0)} y1={py(0)} x2={px(100)} y2={py(fit.poolSize)} className="stroke-teal-600 dark:stroke-teal-400" strokeWidth={2} />
      <text x={px(100) - 4} y={py(fit.poolSize) - 6} textAnchor="end" className="fill-slate-700 text-[11px] font-medium dark:fill-slate-200">
        pool ≈ {fmtUnit(fit.poolSize, fit.unit)}
      </text>
      {fit.points.map((p, i) => (
        <circle key={i} cx={px(p.percent)} cy={py(p.units)} r={4} className="fill-slate-700 stroke-white dark:fill-slate-200 dark:stroke-slate-900" strokeWidth={2}>
          <title>{`${p.percent}% ↔ ${fmtUnit(p.units, fit.unit)}`}</title>
        </circle>
      ))}
    </svg>
  );
}
