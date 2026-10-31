import { useMemo, useState, type ChangeEvent } from 'react';
import { ImportPreview } from '../components/ImportPreview';
import { MAX_IMPORT_BYTES, parseUsageImport, planImport, type ParseResult } from '../lib/importers';
import { href } from '../router';
import { useStore } from '../state';

const EXAMPLE_CSV = `timestamp,tokens,cost
2026-01-05T09:00:00Z,1200000,18.40
2026-01-05T15:00:00Z,800000,12.10`;

export function ImportPage({ accountId }: { accountId?: string }) {
  const { store, dispatch } = useStore();
  const [target, setTarget] = useState(accountId ?? store.accounts[0]?.id ?? '');
  const [text, setText] = useState('');
  const [result, setResult] = useState<ParseResult | null>(null);
  const [fileError, setFileError] = useState<string>();
  const [done, setDone] = useState<string>();
  const account = store.accounts.find((a) => a.id === target);

  const plan = useMemo(
    () => (result?.ok && account ? planImport(result.rows, account, store.readings) : null),
    [result, account, store.readings],
  );

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    setFileError(undefined);
    setDone(undefined);
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > MAX_IMPORT_BYTES) {
      setFileError(`${file.name} is ${(file.size / 1024 / 1024).toFixed(1)} MB; the limit is 2 MB.`);
      return;
    }
    const content = await file.text();
    setText(content);
    setResult(parseUsageImport(content));
  }

  if (store.accounts.length === 0) {
    return (
      <div className="card space-y-2">
        <h1 className="text-lg font-semibold">Import usage</h1>
        <p className="text-sm">Create an account first so imported usage has somewhere to go.</p>
        <a className="btn-primary" href={href({ page: 'dashboard' })}>Go to dashboard</a>
      </div>
    );
  }

  return (
    <section className="space-y-4">
      <div className="card space-y-3">
        <h1 className="text-lg font-semibold">Import usage</h1>
        <p className="muted text-sm">
          Paste or upload <code>ccusage daily --json</code> output or a CSV with <code>timestamp,tokens,cost</code> (optional{' '}
          <code>percent</code>). Token and cost values are summed into each reading&apos;s window so the pool can be calibrated.
          Nothing leaves your browser. Max 2 MB.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="import-account">Account</label>
            <select id="import-account" className="input" value={target} onChange={(e) => setTarget(e.target.value)}>
              {store.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="import-file">Upload file (.json or .csv)</label>
            <input id="import-file" type="file" accept=".json,.csv,.txt,application/json,text/csv" className="block w-full text-sm" onChange={onFile} />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="import-text">Or paste</label>
          <textarea id="import-text" className="input h-40 font-mono text-xs" value={text} onChange={(e) => { setText(e.target.value); setResult(null); setDone(undefined); }} placeholder={EXAMPLE_CSV} spellCheck={false} />
        </div>
        {fileError && <p role="alert" className="text-sm text-rose-700 dark:text-rose-400">{fileError}</p>}
        <div className="flex gap-2">
          <button className="btn-primary" onClick={() => { setDone(undefined); setResult(parseUsageImport(text)); }}>Preview</button>
          <button className="btn-secondary" onClick={() => setText(EXAMPLE_CSV)}>Use example CSV</button>
        </div>
        {done && (
          <p role="status" className="text-sm text-teal-800 dark:text-teal-300">
            {done} <a className="link" href={href({ page: 'account', id: target })}>View account →</a>
          </p>
        )}
      </div>
      {result && (
        <div className="card">
          <ImportPreview
            result={result}
            plan={plan}
            accountName={account?.name}
            onConfirm={() => {
              if (!plan) return;
              dispatch({ type: 'applyImport', plan });
              setDone(`Imported: ${plan.updates.length} readings updated, ${plan.creates.length} added.`);
              setResult(null);
              setText('');
            }}
            onCancel={() => setResult(null)}
          />
        </div>
      )}
    </section>
  );
}
