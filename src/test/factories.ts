import type { Account, Reading } from '../model';

export const T0 = Date.UTC(2026, 0, 5, 0, 0, 0); // Monday 2026-01-05 00:00Z
export const H = 3_600_000;

export function account(over: Partial<Account> = {}): Account {
  return {
    id: 'a1',
    name: 'Acct',
    provider: 'Test',
    windowType: 'weekly-fixed',
    createdAt: new Date(T0).toISOString(),
    ...over,
  };
}

let seq = 0;
export function reading(hours: number, percentUsed: number, over: Partial<Reading> = {}): Reading {
  return {
    id: `r${seq++}`,
    accountId: 'a1',
    at: new Date(T0 + hours * H).toISOString(),
    percentUsed,
    ...over,
  };
}
