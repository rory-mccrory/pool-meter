import { STORE_VERSION, StoreSchema, emptyStore, type Store } from '../model';

export const STORAGE_KEY = 'pool-meter:store';
export const CORRUPT_KEY = 'pool-meter:corrupt-backup';
export const MAX_BACKUP_BYTES = 2 * 1024 * 1024;

export interface LoadResult {
  store: Store;
  warning?: string;
}

/**
 * Upgrades older stored shapes to the current version. Version 1 is the first
 * release, so this only validates; future versions add steps here.
 */
export function migrate(raw: unknown): unknown {
  if (raw && typeof raw === 'object' && !('version' in raw)) {
    return { version: STORE_VERSION, ...raw };
  }
  return raw;
}

export function parseStore(text: string): { ok: true; store: Store } | { ok: false; error: string } {
  if (new TextEncoder().encode(text).length > MAX_BACKUP_BYTES) return { ok: false, error: 'File is larger than 2 MB.' };
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (e) {
    return { ok: false, error: `Invalid JSON: ${(e as Error).message}` };
  }
  const parsed = StoreSchema.safeParse(migrate(json));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, error: `Not a valid Pool Meter backup (${issue?.path.join('.') || 'root'}: ${issue?.message}).` };
  }
  const s = parsed.data;
  const ids = new Set(s.accounts.map((a) => a.id));
  const orphan = s.readings.find((r) => !ids.has(r.accountId)) ?? s.tags.find((t) => !ids.has(t.accountId));
  if (orphan) return { ok: false, error: `Backup references unknown account "${orphan.accountId}".` };
  return { ok: true, store: s };
}

export function loadStore(storage: Storage | undefined = globalThis.localStorage): LoadResult {
  if (!storage) return { store: emptyStore() };
  let text: string | null;
  try {
    text = storage.getItem(STORAGE_KEY);
  } catch {
    return { store: emptyStore(), warning: 'Browser storage is unavailable; changes will not be saved.' };
  }
  if (!text) return { store: emptyStore() };
  const res = parseStore(text);
  if (res.ok) return { store: res.store };
  try {
    storage.setItem(CORRUPT_KEY, text);
  } catch {
    /* ignore */
  }
  return {
    store: emptyStore(),
    warning: `Saved data could not be read and was set aside under "${CORRUPT_KEY}". ${res.error}`,
  };
}

export function saveStore(store: Store, storage: Storage | undefined = globalThis.localStorage): string | undefined {
  if (!storage) return undefined;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(store));
    return undefined;
  } catch (e) {
    return `Could not save to browser storage: ${(e as Error).message}`;
  }
}

export function exportStore(store: Store): string {
  return JSON.stringify(store, null, 2);
}
