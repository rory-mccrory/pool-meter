import { STATUS_LABELS, type Status } from '../lib/forecast';

const STYLES: Record<Status, string> = {
  safe: 'bg-emerald-100 text-emerald-800 ring-emerald-600/20 dark:bg-emerald-950 dark:text-emerald-300',
  tight: 'bg-amber-100 text-amber-900 ring-amber-600/20 dark:bg-amber-950 dark:text-amber-300',
  dry: 'bg-rose-100 text-rose-800 ring-rose-600/20 dark:bg-rose-950 dark:text-rose-300',
  unknown: 'bg-slate-100 text-slate-700 ring-slate-500/20 dark:bg-slate-800 dark:text-slate-300',
};

export const STATUS_BAR: Record<Status, string> = {
  safe: 'bg-emerald-500',
  tight: 'bg-amber-500',
  dry: 'bg-rose-500',
  unknown: 'bg-slate-400',
};

export function StatusBadge({ status }: { status: Status }) {
  return (
    <span
      data-testid="status-badge"
      className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${STYLES[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
