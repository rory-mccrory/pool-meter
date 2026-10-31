import { useState, type FormEvent } from 'react';
import { newId, type Reading } from '../model';
import { parseNumber } from '../lib/importers';
import { fromLocalInput, toLocalInput } from '../lib/time';

interface Props {
  accountId: string;
  now: number;
  initial?: Reading;
  onSubmit: (reading: Reading) => void;
  onCancel?: () => void;
}

/** Add or edit one dashboard reading. Percent is required; tokens and dollars are optional. */
export function ReadingForm({ accountId, now, initial, onSubmit, onCancel }: Props) {
  const [at, setAt] = useState(toLocalInput(initial ? Date.parse(initial.at) : now));
  const [percent, setPercent] = useState(initial ? String(initial.percentUsed) : '');
  const [tokens, setTokens] = useState(initial?.tokens !== undefined ? String(initial.tokens) : '');
  const [dollars, setDollars] = useState(initial?.dollars !== undefined ? String(initial.dollars) : '');
  const [note, setNote] = useState(initial?.note ?? '');
  const [error, setError] = useState<string>();
  const idp = initial ? `edit-${initial.id}` : 'new';

  function submit(e: FormEvent) {
    e.preventDefault();
    const ms = fromLocalInput(at);
    if (!at || !Number.isFinite(ms)) return setError('Enter a valid time.');
    const p = parseNumber(percent);
    if (p === undefined) return setError('Percent used is required.');
    if (p < 0 || p > 100) return setError('Percent used must be between 0 and 100.');
    const t = tokens.trim() ? parseNumber(tokens) : undefined;
    if (tokens.trim() && (t === undefined || t < 0)) return setError('Tokens must be a non-negative number.');
    const d = dollars.trim() ? parseNumber(dollars) : undefined;
    if (dollars.trim() && (d === undefined || d < 0)) return setError('Dollars must be a non-negative number.');
    setError(undefined);
    onSubmit({
      id: initial?.id ?? newId(),
      accountId,
      at: new Date(ms).toISOString(),
      percentUsed: p,
      tokens: t,
      dollars: d,
      note: note.trim() || undefined,
    });
    if (!initial) {
      setPercent('');
      setTokens('');
      setDollars('');
      setNote('');
      setAt(toLocalInput(Date.now()));
    }
  }

  return (
    <form onSubmit={submit} aria-label={initial ? 'Edit reading' : 'Add reading'} className="grid grid-cols-2 gap-3 md:grid-cols-6" noValidate>
      <div className="col-span-2">
        <label className="label" htmlFor={`${idp}-at`}>Time</label>
        <input id={`${idp}-at`} type="datetime-local" className="input" value={at} onChange={(e) => setAt(e.target.value)} />
      </div>
      <div>
        <label className="label" htmlFor={`${idp}-pct`}>Percent used *</label>
        <input id={`${idp}-pct`} inputMode="decimal" className="input" value={percent} onChange={(e) => setPercent(e.target.value)} placeholder="42" />
      </div>
      <div>
        <label className="label" htmlFor={`${idp}-tok`}>Tokens</label>
        <input id={`${idp}-tok`} inputMode="numeric" className="input" value={tokens} onChange={(e) => setTokens(e.target.value)} placeholder="optional" />
      </div>
      <div>
        <label className="label" htmlFor={`${idp}-usd`}>Dollars</label>
        <input id={`${idp}-usd`} inputMode="decimal" className="input" value={dollars} onChange={(e) => setDollars(e.target.value)} placeholder="optional" />
      </div>
      <div className="col-span-2 md:col-span-1">
        <label className="label" htmlFor={`${idp}-note`}>Note</label>
        <input id={`${idp}-note`} className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="optional" />
      </div>
      {error && <p role="alert" className="col-span-2 text-sm text-rose-700 dark:text-rose-400 md:col-span-6">{error}</p>}
      <div className="col-span-2 flex gap-2 md:col-span-6">
        <button type="submit" className="btn-primary">{initial ? 'Save reading' : 'Add reading'}</button>
        {onCancel && <button type="button" className="btn-secondary" onClick={onCancel}>Cancel</button>}
      </div>
    </form>
  );
}
