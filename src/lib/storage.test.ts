import { describe, expect, it } from 'vitest';
import { emptyStore } from '../model';
import { sampleStore } from './sample';
import { CORRUPT_KEY, exportStore, loadStore, parseStore, saveStore, STORAGE_KEY } from './storage';

describe('storage', () => {
  it('round-trips through localStorage', () => {
    const s = sampleStore(Date.UTC(2026, 0, 10));
    saveStore(s, localStorage);
    expect(loadStore(localStorage).store).toEqual(s);
  });

  it('returns an empty store when nothing is saved', () => {
    expect(loadStore(localStorage)).toEqual({ store: emptyStore() });
  });

  it('sets aside corrupt data with a warning', () => {
    localStorage.setItem(STORAGE_KEY, '{oops');
    const r = loadStore(localStorage);
    expect(r.store).toEqual(emptyStore());
    expect(r.warning).toMatch(/set aside/);
    expect(localStorage.getItem(CORRUPT_KEY)).toBe('{oops');
  });

  it('round-trips export and import', () => {
    const s = sampleStore(Date.UTC(2026, 0, 10));
    const r = parseStore(exportStore(s));
    expect(r.ok && r.store).toEqual(s);
  });

  it('rejects wrong versions, bad fields and orphans', () => {
    expect(parseStore(JSON.stringify({ ...emptyStore(), version: 99 })).ok).toBe(false);
    const bad = { ...emptyStore(), readings: [{ id: 'r', accountId: 'x', at: 'nope', percentUsed: 1 }] };
    expect(parseStore(JSON.stringify(bad)).ok).toBe(false);
    const orphan = { ...emptyStore(), readings: [{ id: 'r', accountId: 'x', at: '2026-01-01T00:00:00Z', percentUsed: 1 }] };
    const r = parseStore(JSON.stringify(orphan));
    expect(!r.ok && r.error).toMatch(/unknown account/);
  });
});
