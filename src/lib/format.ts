import type { PoolUnit } from './fitPool';

export function fmtPct(v: number | null | undefined, digits = 0): string {
  return v === null || v === undefined || !Number.isFinite(v) ? '—' : `${v.toFixed(digits)}%`;
}

export function fmtTokens(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  if (v >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)}k`;
  return `${Math.round(v)}`;
}

export function fmtDollars(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  return v >= 100 ? `$${v.toFixed(0)}` : `$${v.toFixed(2)}`;
}

export function fmtUnit(v: number | null | undefined, unit: PoolUnit): string {
  return unit === 'dollars' ? fmtDollars(v) : `${fmtTokens(v)} tokens`;
}
