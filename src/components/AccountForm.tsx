import { useState, type FormEvent } from 'react';
import { newId, WINDOW_LABELS, WINDOW_TYPES, type Account, type WindowType } from '../model';
import { fromLocalInput, toLocalInput } from '../lib/time';

interface Props {
  initial?: Account;
  onSave: (account: Account) => void;
  onCancel?: () => void;
}

export function AccountForm({ initial, onSave, onCancel }: Props) {
  const [name, setName] = useState(initial?.name ?? '');
  const [provider, setProvider] = useState(initial?.provider ?? '');
  const [plan, setPlan] = useState(initial?.plan ?? '');
  const [windowType, setWindowType] = useState<WindowType>(initial?.windowType ?? 'weekly-fixed');
  const [resetAt, setResetAt] = useState(initial?.resetAt ? toLocalInput(Date.parse(initial.resetAt)) : '');
  const [error, setError] = useState<string>();

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError('Name is required.');
    let reset: string | undefined;
    if (resetAt) {
      const ms = fromLocalInput(resetAt);
      if (!Number.isFinite(ms)) return setError('Reset time is not a valid date.');
      reset = new Date(ms).toISOString();
    }
    onSave({
      id: initial?.id ?? newId(),
      name: name.trim(),
      provider: provider.trim(),
      plan: plan.trim() || undefined,
      windowType,
      resetAt: reset,
      createdAt: initial?.createdAt ?? new Date().toISOString(),
    });
  }

  return (
    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2" aria-label={initial ? 'Edit account' : 'Add account'}>
      <div>
        <label className="label" htmlFor="acct-name">Name *</label>
        <input id="acct-name" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Claude Max A" />
      </div>
      <div>
        <label className="label" htmlFor="acct-provider">Provider</label>
        <input id="acct-provider" className="input" value={provider} onChange={(e) => setProvider(e.target.value)} placeholder="Anthropic, OpenAI, Cursor…" />
      </div>
      <div>
        <label className="label" htmlFor="acct-plan">Plan (optional)</label>
        <input id="acct-plan" className="input" value={plan} onChange={(e) => setPlan(e.target.value)} placeholder="Max 20x" />
      </div>
      <div>
        <label className="label" htmlFor="acct-window">Window</label>
        <select id="acct-window" className="input" value={windowType} onChange={(e) => setWindowType(e.target.value as WindowType)}>
          {WINDOW_TYPES.map((w) => (
            <option key={w} value={w}>{WINDOW_LABELS[w]}</option>
          ))}
        </select>
      </div>
      <div className="sm:col-span-2">
        <label className="label" htmlFor="acct-reset">Next reset (if known)</label>
        <input id="acct-reset" type="datetime-local" className="input sm:w-auto" value={resetAt} onChange={(e) => setResetAt(e.target.value)} />
        <p className="muted mt-1 text-xs">Past times roll forward by one window. Leave blank to estimate from your first reading.</p>
      </div>
      {error && <p role="alert" className="text-sm text-rose-700 dark:text-rose-400 sm:col-span-2">{error}</p>}
      <div className="flex gap-2 sm:col-span-2">
        <button type="submit" className="btn-primary">{initial ? 'Save account' : 'Add account'}</button>
        {onCancel && <button type="button" className="btn-secondary" onClick={onCancel}>Cancel</button>}
      </div>
    </form>
  );
}
