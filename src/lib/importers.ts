import { z } from 'zod';
import type { Account, Reading } from '../model';
import { newId } from '../model';
import { DAY_MS, periodMs, toMs } from './time';
import { nextReset, splitWindows } from './windows';

/** Hard cap on pasted or uploaded import size. */
export const MAX_IMPORT_BYTES = 2 * 1024 * 1024;

/**
 * One usage record from an import. Daily rows span a whole local calendar day
 * (start < end); timestamped CSV rows are instants (start === end). Token and
 * cost values are the usage *during* that row, not running totals.
 */
export interface UsageRow {
  line: number;
  label: string;
  start: number;
  end: number;
  tokens?: number;
  dollars?: number;
  percent?: number;
}

export type ImportFormat = 'ccusage-json' | 'csv' | 'backup' | 'unknown';

export interface ParseResult {
  ok: boolean;
  format: ImportFormat;
  rows: UsageRow[];
  warnings: string[];
  error?: string;
}

export function byteLength(text: string): number {
  return new TextEncoder().encode(text).length;
}

/** Parses "1,234", "$3.50", "42%", " 7 " and plain numbers. */
export function parseNumber(v: unknown): number | undefined {
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined;
  if (typeof v !== 'string') return undefined;
  const cleaned = v.trim().replace(/[$%\s_]/g, '').replace(/,/g, '');
  if (cleaned === '') return undefined;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : undefined;
}

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Parses a timestamp into [start, end). "YYYY-MM-DD" is a whole local day; ISO
 * date-times and other Date-parsable strings are instants; bare numbers are epoch
 * seconds (or milliseconds when above 1e12).
 */
export function parseTimestamp(v: unknown): { start: number; end: number } | undefined {
  if (typeof v === 'number' || (typeof v === 'string' && /^\s*\d{9,14}(\.\d+)?\s*$/.test(v))) {
    const n = Number(v);
    if (!Number.isFinite(n) || n <= 0) return undefined;
    const ms = n > 1e12 ? n : n * 1000;
    return { start: ms, end: ms };
  }
  if (typeof v !== 'string') return undefined;
  const s = v.trim();
  const m = DATE_ONLY.exec(s);
  if (m) {
    const start = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime();
    const end = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + 1).getTime();
    return Number.isFinite(start) ? { start, end } : undefined;
  }
  const ms = Date.parse(s);
  return Number.isFinite(ms) ? { start: ms, end: ms } : undefined;
}

const looseNumber = z.preprocess((v) => (v === null || v === '' ? undefined : parseNumber(v) ?? v), z.number().finite().nonnegative().optional());

/** Accepted shape of one ccusage daily entry. Unknown fields are ignored. */
export const CcusageDailySchema = z
  .object({
    date: z.string().min(1),
    totalTokens: looseNumber,
    total_tokens: looseNumber,
    inputTokens: looseNumber,
    outputTokens: looseNumber,
    cacheCreationTokens: looseNumber,
    cacheReadTokens: looseNumber,
    totalCost: looseNumber,
    total_cost: looseNumber,
    costUSD: looseNumber,
    cost: looseNumber,
  })
  .passthrough();

function looksLikeBackup(v: unknown): boolean {
  return !!v && typeof v === 'object' && !Array.isArray(v) && 'version' in v && 'accounts' in v && 'readings' in v;
}

function parseCcusage(json: unknown): ParseResult {
  const warnings: string[] = [];
  let entries: unknown[] | undefined;
  if (Array.isArray(json)) entries = json;
  else if (json && typeof json === 'object') {
    const o = json as Record<string, unknown>;
    for (const key of ['daily', 'data', 'days']) {
      if (Array.isArray(o[key])) {
        entries = o[key] as unknown[];
        break;
      }
    }
  }
  if (!entries) {
    return {
      ok: false,
      format: 'unknown',
      rows: [],
      warnings,
      error: 'JSON must be an array or an object with a "daily" array (ccusage daily --json).',
    };
  }
  const rows: UsageRow[] = [];
  entries.forEach((raw, i) => {
    const parsed = CcusageDailySchema.safeParse(raw);
    if (!parsed.success) {
      warnings.push(`Entry ${i + 1}: skipped (${parsed.error.issues[0]?.path.join('.') || 'entry'}: ${parsed.error.issues[0]?.message}).`);
      return;
    }
    const e = parsed.data;
    const ts = parseTimestamp(e.date);
    if (!ts) {
      warnings.push(`Entry ${i + 1}: skipped (unreadable date "${e.date}").`);
      return;
    }
    let tokens = e.totalTokens ?? e.total_tokens;
    if (tokens === undefined) {
      const parts = [e.inputTokens, e.outputTokens, e.cacheCreationTokens, e.cacheReadTokens].filter(
        (x): x is number => x !== undefined,
      );
      if (parts.length) {
        tokens = parts.reduce((a, b) => a + b, 0);
        warnings.push(`Entry ${i + 1}: no totalTokens, summed input/output/cache tokens instead.`);
      }
    }
    const dollars = e.totalCost ?? e.total_cost ?? e.costUSD ?? e.cost;
    if (tokens === undefined && dollars === undefined) {
      warnings.push(`Entry ${i + 1}: skipped (no tokens or cost).`);
      return;
    }
    rows.push({ line: i + 1, label: e.date, ...ts, tokens, dollars });
  });
  if (rows.length === 0) {
    return { ok: false, format: 'ccusage-json', rows, warnings, error: 'No usable entries found in the JSON.' };
  }
  return { ok: true, format: 'ccusage-json', rows: rows.sort((a, b) => a.start - b.start), warnings };
}

/** Minimal CSV splitter supporting quoted fields and doubled quotes. */
export function splitCsvLine(line: string, delim: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i]!;
    if (quoted) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cur += c;
    } else if (c === '"') quoted = true;
    else if (c === delim) {
      out.push(cur);
      cur = '';
    } else cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

const COLUMN_ALIASES: Record<'ts' | 'tokens' | 'dollars' | 'percent', string[]> = {
  ts: ['timestamp', 'time', 'date', 'datetime', 'at', 'when'],
  tokens: ['tokens', 'totaltokens', 'tokensused', 'tok'],
  dollars: ['cost', 'dollars', 'usd', 'totalcost', 'costusd', 'spend', 'dollarsused'],
  percent: ['percent', 'pct', 'percentused', 'usedpercent', 'used'],
};

function normHeader(h: string): string {
  return h.toLowerCase().replace(/[^a-z]/g, '');
}

function parseCsv(text: string): ParseResult {
  const warnings: string[] = [];
  const lines = text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((l, i) => ({ text: l, line: i + 1 }))
    .filter((l) => l.text.trim() !== '' && !l.text.trim().startsWith('#'));
  if (lines.length === 0) return { ok: false, format: 'csv', rows: [], warnings, error: 'The CSV is empty.' };

  const firstLine = lines[0]!.text;
  const delim = ['\t', ';', ','].reduce((best, d) =>
    firstLine.split(d).length > firstLine.split(best).length ? d : best,
  );
  const first = splitCsvLine(firstLine, delim);
  const hasHeader = !parseTimestamp(first[0]) || first.some((c) => /[a-z]{3,}/i.test(c) && !parseTimestamp(c));
  let cols = { ts: 0, tokens: 1, dollars: 2, percent: 3 } as Record<keyof typeof COLUMN_ALIASES, number>;
  if (hasHeader) {
    const headers = first.map(normHeader);
    const find = (k: keyof typeof COLUMN_ALIASES) => headers.findIndex((h) => COLUMN_ALIASES[k].includes(h));
    cols = { ts: find('ts'), tokens: find('tokens'), dollars: find('dollars'), percent: find('percent') };
    if (cols.ts < 0) {
      return {
        ok: false,
        format: 'csv',
        rows: [],
        warnings,
        error: `No timestamp column found. Expected a header like "timestamp,tokens,cost". Got: ${first.join(', ')}`,
      };
    }
    if (cols.tokens < 0 && cols.dollars < 0) {
      return { ok: false, format: 'csv', rows: [], warnings, error: 'No tokens or cost column found in the header.' };
    }
  } else {
    warnings.push('No header row: assuming columns timestamp, tokens, cost[, percent].');
  }

  const rows: UsageRow[] = [];
  for (const l of lines.slice(hasHeader ? 1 : 0)) {
    const cells = splitCsvLine(l.text, delim);
    const ts = parseTimestamp(cells[cols.ts]);
    if (!ts) {
      warnings.push(`Line ${l.line}: skipped (unreadable timestamp "${cells[cols.ts] ?? ''}").`);
      continue;
    }
    const cell = (i: number) => (i >= 0 ? cells[i] : undefined);
    const tokens = parseNumber(cell(cols.tokens));
    const dollars = parseNumber(cell(cols.dollars));
    const percent = parseNumber(cell(cols.percent));
    if ((tokens !== undefined && tokens < 0) || (dollars !== undefined && dollars < 0)) {
      warnings.push(`Line ${l.line}: skipped (negative value).`);
      continue;
    }
    if (tokens === undefined && dollars === undefined && percent === undefined) {
      warnings.push(`Line ${l.line}: skipped (no tokens, cost or percent).`);
      continue;
    }
    rows.push({ line: l.line, label: cells[cols.ts] ?? '', ...ts, tokens, dollars, percent });
  }
  if (rows.length === 0) return { ok: false, format: 'csv', rows, warnings, error: 'No usable rows found in the CSV.' };
  return { ok: true, format: 'csv', rows: rows.sort((a, b) => a.start - b.start), warnings };
}

/** Detects ccusage-style JSON or CSV and parses it tolerantly. Never throws. */
export function parseUsageImport(text: string): ParseResult {
  if (byteLength(text) > MAX_IMPORT_BYTES) {
    return { ok: false, format: 'unknown', rows: [], warnings: [], error: 'Import is larger than 2 MB.' };
  }
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, format: 'unknown', rows: [], warnings: [], error: 'Nothing to import: the input is empty.' };
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    let json: unknown;
    try {
      json = JSON.parse(trimmed);
    } catch (e) {
      return {
        ok: false,
        format: 'unknown',
        rows: [],
        warnings: [],
        error: `Invalid JSON: ${(e as Error).message}`,
      };
    }
    if (looksLikeBackup(json)) {
      return {
        ok: false,
        format: 'backup',
        rows: [],
        warnings: [],
        error: 'This looks like a Pool Meter backup. Restore it from Settings instead.',
      };
    }
    return parseCcusage(json);
  }
  return parseCsv(trimmed);
}

export interface PlannedUpdate {
  reading: Reading;
  tokens?: number;
  dollars?: number;
  partial: boolean;
}

export interface ImportPlan {
  updates: PlannedUpdate[];
  creates: Reading[];
  notes: string[];
}

/** Usage from rows inside (start, end], pro-rating day-long rows by overlap. */
export function cumulativeUsage(rows: readonly UsageRow[], start: number, end: number, unit: 'tokens' | 'dollars'): number | undefined {
  let total = 0;
  let seen = false;
  for (const r of rows) {
    const v = r[unit];
    if (v === undefined) continue;
    let frac: number;
    if (r.end > r.start) frac = Math.max(0, Math.min(r.end, end) - Math.max(r.start, start)) / (r.end - r.start);
    else frac = r.start > start && r.start <= end ? 1 : 0;
    if (frac > 0) {
      total += v * frac;
      seen = true;
    }
  }
  return seen ? total : undefined;
}

/**
 * Start of the usage window that a reading at time t belongs to, used to turn
 * per-row usage into the running total a dashboard would show.
 */
function cumulativeStart(account: Account, t: number, prevWindowEnd: number | undefined): number {
  if (account.windowType === 'weekly-rolling') return t - periodMs('weekly-rolling');
  if (account.resetAt) return nextReset(account, undefined, t)!.previous;
  const lower = t - periodMs(account.windowType);
  return prevWindowEnd !== undefined ? Math.max(lower, prevWindowEnd) : lower;
}

/**
 * Turns parsed rows into changes for one account. Rows that carry a percent become
 * new readings; every reading (existing and new) gets tokens/dollars equal to the
 * imported usage accumulated since its window start.
 */
export function planImport(rows: readonly UsageRow[], account: Account, readings: readonly Reading[]): ImportPlan {
  const notes: string[] = [];
  const own = readings.filter((r) => r.accountId === account.id);
  const creates: Reading[] = rows
    .filter((r) => r.percent !== undefined)
    .map((r) => ({
      id: newId(),
      accountId: account.id,
      at: new Date(r.end).toISOString(),
      percentUsed: Math.min(1000, Math.max(0, r.percent!)),
      note: `Imported (line ${r.line})`,
    }));
  const hasTokens = rows.some((r) => r.tokens !== undefined);
  const hasDollars = rows.some((r) => r.dollars !== undefined);
  const earliest = Math.min(...rows.map((r) => r.start));
  const latest = Math.max(...rows.map((r) => r.end));

  const windows = splitWindows([...own, ...creates]);
  const createdIds = new Set(creates.map((c) => c.id));
  const updates: PlannedUpdate[] = [];
  windows.forEach((w, wi) => {
    const prev = windows[wi - 1]?.readings;
    const prevEnd = prev ? toMs(prev[prev.length - 1]!.at) : undefined;
    for (const r of w.readings) {
      const t = toMs(r.at);
      const start = cumulativeStart(account, t, prevEnd);
      const tokens = hasTokens ? cumulativeUsage(rows, start, t, 'tokens') : undefined;
      const dollars = hasDollars ? cumulativeUsage(rows, start, t, 'dollars') : undefined;
      if (tokens === undefined && dollars === undefined) continue;
      const partial = start < earliest || t > latest + DAY_MS;
      if (createdIds.has(r.id)) {
        const c = creates.find((x) => x.id === r.id)!;
        if (tokens !== undefined) c.tokens = Math.round(tokens);
        if (dollars !== undefined) c.dollars = Math.round(dollars * 100) / 100;
      } else {
        updates.push({
          reading: r,
          tokens: tokens !== undefined ? Math.round(tokens) : undefined,
          dollars: dollars !== undefined ? Math.round(dollars * 100) / 100 : undefined,
          partial,
        });
      }
    }
  });

  if (own.length === 0 && creates.length === 0) {
    notes.push('This account has no percent readings yet. Add readings first, or include a percent column in the CSV, so imported usage can be matched to them.');
  } else if (updates.length === 0 && creates.length === 0) {
    notes.push('No existing reading falls inside the imported date range.');
  }
  if (updates.some((u) => u.partial)) {
    notes.push('Some readings fall outside the imported range, so their totals may be incomplete (marked "partial").');
  }
  return { updates, creates, notes };
}
