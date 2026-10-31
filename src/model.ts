import { z } from 'zod';

/** Current on-disk schema version. Bump and add a migration in lib/storage.ts when the shape changes. */
export const STORE_VERSION = 1 as const;

export const WINDOW_TYPES = ['weekly-rolling', 'weekly-fixed', 'monthly'] as const;
export type WindowType = (typeof WINDOW_TYPES)[number];

export const WINDOW_LABELS: Record<WindowType, string> = {
  'weekly-rolling': 'Weekly (rolling)',
  'weekly-fixed': 'Weekly (fixed reset)',
  monthly: 'Monthly',
};

export const SPIKE_TAGS = ['idle-cache-rebuild', 'agent-chatter', 'other'] as const;
export type SpikeTagKind = (typeof SPIKE_TAGS)[number];

export const SPIKE_TAG_LABELS: Record<SpikeTagKind, string> = {
  'idle-cache-rebuild': 'Idle cache rebuild',
  'agent-chatter': 'Agent-to-agent chatter',
  other: 'Other',
};

const isoDate = z
  .string()
  .refine((s) => !Number.isNaN(Date.parse(s)), { message: 'Invalid date-time string' });

export const AccountSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(200),
  provider: z.string().max(200),
  plan: z.string().max(200).optional(),
  windowType: z.enum(WINDOW_TYPES),
  /** ISO timestamp of a known reset. Rolled forward by the window period when it is in the past. */
  resetAt: isoDate.optional(),
  createdAt: isoDate,
});
export type Account = z.infer<typeof AccountSchema>;

export const ReadingSchema = z.object({
  id: z.string().min(1),
  accountId: z.string().min(1),
  at: isoDate,
  percentUsed: z.number().finite().min(0).max(1000),
  /** Cumulative tokens used in the current window at time `at`, as a dashboard would show. */
  tokens: z.number().finite().nonnegative().optional(),
  /** Cumulative dollars used in the current window at time `at`. */
  dollars: z.number().finite().nonnegative().optional(),
  note: z.string().max(2000).optional(),
});
export type Reading = z.infer<typeof ReadingSchema>;

export const SpikeTagSchema = z.object({
  id: z.string().min(1),
  accountId: z.string().min(1),
  from: isoDate,
  to: isoDate,
  tag: z.enum(SPIKE_TAGS),
});
export type SpikeTag = z.infer<typeof SpikeTagSchema>;

export const StoreSchema = z.object({
  version: z.literal(STORE_VERSION),
  accounts: z.array(AccountSchema),
  readings: z.array(ReadingSchema),
  tags: z.array(SpikeTagSchema),
});
export type Store = z.infer<typeof StoreSchema>;

export function emptyStore(): Store {
  return { version: STORE_VERSION, accounts: [], readings: [], tags: [] };
}

export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
