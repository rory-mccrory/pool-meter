import type { Reading } from '../model';

export type PoolUnit = 'tokens' | 'dollars';
export type Confidence = 'low' | 'medium' | 'high';

export interface PoolFit {
  unit: PoolUnit;
  /** Estimated units in a full (100 %) pool. */
  poolSize: number;
  /** Units per percentage point (the fitted slope). */
  unitsPerPercent: number;
  /** Number of readings used. */
  n: number;
  /** Spread of percent values used, in points (max - min). */
  spread: number;
  /** Root-mean-square residual divided by mean units: 0 is a perfect fit. */
  relError: number;
  confidence: Confidence;
  /** Plain-language reason for the confidence label. */
  reason: string;
  points: { percent: number; units: number }[];
}

/** Below this many points of spread the fit is labelled low confidence. */
export const MIN_SPREAD_POINTS = 10;
/** Spread and error needed for a "high" label. */
export const HIGH_SPREAD_POINTS = 25;
export const HIGH_MIN_READINGS = 5;
export const HIGH_MAX_REL_ERROR = 0.1;

/**
 * Least-squares fit through the origin of units = k * percent, using readings that
 * carry the given unit and a positive percent. Pool size is 100 * k.
 * Returns null when no usable reading exists.
 */
export function fitPool(readings: readonly Reading[], unit: PoolUnit): PoolFit | null {
  const points = readings
    .filter((r) => r[unit] !== undefined && Number.isFinite(r[unit]) && r.percentUsed > 0)
    .map((r) => ({ percent: r.percentUsed, units: r[unit] as number }));
  if (points.length === 0) return null;

  let sxy = 0;
  let sxx = 0;
  for (const p of points) {
    sxy += p.percent * p.units;
    sxx += p.percent * p.percent;
  }
  const k = sxy / sxx;
  if (!Number.isFinite(k) || k <= 0) return null;

  const n = points.length;
  const percents = points.map((p) => p.percent);
  const spread = Math.max(...percents) - Math.min(...percents);
  const meanUnits = points.reduce((s, p) => s + p.units, 0) / n;
  const sse = points.reduce((s, p) => s + (p.units - k * p.percent) ** 2, 0);
  const relError = meanUnits > 0 ? Math.sqrt(sse / n) / meanUnits : 0;

  let confidence: Confidence;
  let reason: string;
  if (n < 3) {
    confidence = 'low';
    reason = `Only ${n} reading${n === 1 ? '' : 's'} with ${unit}; add at least 3.`;
  } else if (spread < MIN_SPREAD_POINTS) {
    confidence = 'low';
    reason = `Readings span only ${spread.toFixed(0)} points of percent; spread them out further.`;
  } else if (n >= HIGH_MIN_READINGS && spread >= HIGH_SPREAD_POINTS && relError <= HIGH_MAX_REL_ERROR) {
    confidence = 'high';
    reason = `${n} readings over ${spread.toFixed(0)} points agree within ${(relError * 100).toFixed(0)}%.`;
  } else {
    confidence = 'medium';
    reason =
      relError > HIGH_MAX_REL_ERROR
        ? `Readings disagree by about ${(relError * 100).toFixed(0)}%; the pool may have changed or units are partial.`
        : `${n} readings over ${spread.toFixed(0)} points; more spread raises confidence.`;
  }

  return { unit, poolSize: k * 100, unitsPerPercent: k, n, spread, relError, confidence, reason, points };
}
