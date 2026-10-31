import type { WindowType } from '../model';

export const HOUR_MS = 3_600_000;
export const DAY_MS = 24 * HOUR_MS;
export const WEEK_MS = 7 * DAY_MS;

export function toMs(iso: string): number {
  return Date.parse(iso);
}

/**
 * Adds `times` window periods to a timestamp. Monthly uses UTC calendar months and
 * clamps to the last day of shorter months (Jan 31 + 1 month = Feb 28/29).
 */
export function addPeriod(ms: number, windowType: WindowType, times = 1): number {
  if (windowType === 'monthly') {
    const d = new Date(ms);
    const day = d.getUTCDate();
    const target = new Date(ms);
    target.setUTCDate(1);
    target.setUTCMonth(target.getUTCMonth() + times);
    const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
    target.setUTCDate(Math.min(day, lastDay));
    return target.getTime();
  }
  return ms + WEEK_MS * times;
}

/** Approximate period length, used where an exact calendar month is not needed. */
export function periodMs(windowType: WindowType): number {
  return windowType === 'monthly' ? 30 * DAY_MS : WEEK_MS;
}

export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms)) return '—';
  const sign = ms < 0 ? '-' : '';
  const abs = Math.abs(ms);
  const h = abs / HOUR_MS;
  if (h < 1) return `${sign}${Math.round(abs / 60_000)}m`;
  if (h < 48) {
    const whole = Math.floor(h);
    const m = Math.round((h - whole) * 60);
    return `${sign}${whole}h${m ? ` ${m}m` : ''}`;
  }
  const d = Math.floor(h / 24);
  const rh = Math.round(h - d * 24);
  return `${sign}${d}d${rh ? ` ${rh}h` : ''}`;
}

export function formatDateTime(ms: number): string {
  return new Date(ms).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Value for <input type="datetime-local"> in local time. */
export function toLocalInput(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromLocalInput(value: string): number {
  return new Date(value).getTime();
}
