import { createContext, useContext, useEffect, useMemo, useReducer, useState, type ReactNode } from 'react';
import { emptyStore, newId, type Account, type Reading, type SpikeTag, type SpikeTagKind, type Store } from './model';
import type { ImportPlan } from './lib/importers';
import { loadStore, saveStore } from './lib/storage';

export type Action =
  | { type: 'replace'; store: Store }
  | { type: 'clear' }
  | { type: 'addAccount'; account: Account }
  | { type: 'updateAccount'; account: Account }
  | { type: 'deleteAccount'; id: string }
  | { type: 'addReading'; reading: Reading }
  | { type: 'updateReading'; reading: Reading }
  | { type: 'deleteReading'; id: string }
  | { type: 'setTag'; accountId: string; from: string; to: string; tag: SpikeTagKind | null }
  | { type: 'applyImport'; plan: ImportPlan };

export function reducer(state: Store, action: Action): Store {
  switch (action.type) {
    case 'replace':
      return action.store;
    case 'clear':
      return emptyStore();
    case 'addAccount':
      return { ...state, accounts: [...state.accounts, action.account] };
    case 'updateAccount':
      return { ...state, accounts: state.accounts.map((a) => (a.id === action.account.id ? action.account : a)) };
    case 'deleteAccount':
      return {
        ...state,
        accounts: state.accounts.filter((a) => a.id !== action.id),
        readings: state.readings.filter((r) => r.accountId !== action.id),
        tags: state.tags.filter((t) => t.accountId !== action.id),
      };
    case 'addReading':
      return { ...state, readings: [...state.readings, action.reading] };
    case 'updateReading':
      return { ...state, readings: state.readings.map((r) => (r.id === action.reading.id ? action.reading : r)) };
    case 'deleteReading':
      return { ...state, readings: state.readings.filter((r) => r.id !== action.id) };
    case 'setTag': {
      const same = (t: SpikeTag) =>
        t.accountId === action.accountId && Date.parse(t.from) === Date.parse(action.from) && Date.parse(t.to) === Date.parse(action.to);
      const rest = state.tags.filter((t) => !same(t));
      if (!action.tag) return { ...state, tags: rest };
      return {
        ...state,
        tags: [...rest, { id: newId(), accountId: action.accountId, from: action.from, to: action.to, tag: action.tag }],
      };
    }
    case 'applyImport': {
      const byId = new Map(action.plan.updates.map((u) => [u.reading.id, u]));
      const readings = state.readings.map((r) => {
        const u = byId.get(r.id);
        if (!u) return r;
        return {
          ...r,
          ...(u.tokens !== undefined ? { tokens: u.tokens } : {}),
          ...(u.dollars !== undefined ? { dollars: u.dollars } : {}),
        };
      });
      return { ...state, readings: [...readings, ...action.plan.creates] };
    }
  }
}

interface Ctx {
  store: Store;
  dispatch: (a: Action) => void;
  now: number;
  warning?: string;
}

const StoreContext = createContext<Ctx | null>(null);

export function StoreProvider({ children, initial, fixedNow }: { children: ReactNode; initial?: Store; fixedNow?: number }) {
  const [loaded] = useState(() => (initial ? { store: initial } : loadStore()));
  const [store, dispatch] = useReducer(reducer, loaded.store);
  const [saveError, setSaveError] = useState<string>();
  const [now, setNow] = useState(() => fixedNow ?? Date.now());

  useEffect(() => {
    setSaveError(saveStore(store));
  }, [store]);

  useEffect(() => {
    if (fixedNow !== undefined) return;
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, [fixedNow]);

  // Refresh "now" immediately after any change so new readings are not in the future.
  useEffect(() => {
    if (fixedNow === undefined) setNow(Date.now());
  }, [store, fixedNow]);

  const value = useMemo(
    () => ({ store, dispatch, now, warning: saveError ?? loaded.warning }),
    [store, now, saveError, loaded.warning],
  );
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Ctx {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside StoreProvider');
  return ctx;
}
