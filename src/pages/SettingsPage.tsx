import { useState, type ChangeEvent } from 'react';
import type { Store } from '../model';
import { sampleStore } from '../lib/sample';
import { exportStore, MAX_BACKUP_BYTES, parseStore } from '../lib/storage';
import { useStore } from '../state';

export function backupFilename(now: number): string {
  return `pool-meter-backup-${new Date(now).toISOString().slice(0, 10)}.json`;
}

export function SettingsPage() {
  const { store, dispatch, now } = useStore();
  const [pending, setPending] = useState<Store | null>(null);
  const [error, setError] = useState<string>();
  const [message, setMessage] = useState<string>();
  const [confirmClear, setConfirmClear] = useState(false);

  function download() {
    const blob = new Blob([exportStore(store)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = backupFilename(now);
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage('Backup downloaded.');
  }

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    setError(undefined);
    setMessage(undefined);
    setPending(null);
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > MAX_BACKUP_BYTES) return setError(`${file.name} is larger than 2 MB.`);
    const res = parseStore(await file.text());
    if (!res.ok) return setError(res.error);
    setPending(res.store);
  }

  return (
    <section className="space-y-4">
      <div className="card space-y-2">
        <h1 className="text-lg font-semibold">Export</h1>
        <p className="muted text-sm">
          Download everything ({store.accounts.length} accounts, {store.readings.length} readings, {store.tags.length} spike tags) as one JSON file.
        </p>
        <button className="btn-primary" onClick={download}>Export JSON</button>
      </div>

      <div className="card space-y-2">
        <h2 className="text-lg font-semibold">Restore from backup</h2>
        <p className="muted text-sm">Validated before anything changes. Restoring replaces all current data. Max 2 MB.</p>
        <label className="label" htmlFor="backup-file">Backup file</label>
        <input id="backup-file" type="file" accept=".json,application/json" className="block text-sm" onChange={onFile} />
        {error && <p role="alert" className="text-sm text-rose-700 dark:text-rose-400">{error}</p>}
        {pending && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-800">
            <span>
              Backup contains {pending.accounts.length} accounts, {pending.readings.length} readings, {pending.tags.length} tags.
            </span>
            <button className="btn-primary" onClick={() => { dispatch({ type: 'replace', store: pending }); setPending(null); setMessage('Backup restored.'); }}>
              Replace all data
            </button>
            <button className="btn-secondary" onClick={() => setPending(null)}>Cancel</button>
          </div>
        )}
      </div>

      <div className="card space-y-2">
        <h2 className="text-lg font-semibold">Data</h2>
        <div className="flex flex-wrap gap-2">
          <button className="btn-secondary" onClick={() => { dispatch({ type: 'replace', store: sampleStore(Date.now()) }); setMessage('Sample data loaded.'); }}>
            Load sample data
          </button>
          {confirmClear ? (
            <>
              <button className="btn-danger" onClick={() => { dispatch({ type: 'clear' }); setConfirmClear(false); setMessage('All data cleared.'); }}>
                Yes, delete everything
              </button>
              <button className="btn-secondary" onClick={() => setConfirmClear(false)}>Cancel</button>
            </>
          ) : (
            <button className="btn-secondary text-rose-700 dark:text-rose-400" onClick={() => setConfirmClear(true)}>Clear all data…</button>
          )}
        </div>
        <p className="muted text-xs">Loading sample data replaces your current data; export first if you want to keep it.</p>
      </div>
      {message && <p role="status" className="text-sm text-teal-800 dark:text-teal-300">{message}</p>}

      <div className="card space-y-1 text-sm">
        <h2 className="text-lg font-semibold">Privacy</h2>
        <p>Pool Meter has no server. Data is stored only in this browser&apos;s localStorage and in files you export. The app makes no network requests after it loads, and a Content-Security-Policy blocks third-party scripts, fonts and connections.</p>
      </div>
    </section>
  );
}
