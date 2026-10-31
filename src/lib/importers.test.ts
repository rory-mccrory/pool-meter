import { describe, expect, it } from 'vitest';
import fixture from '../test/fixtures/ccusage-daily.json?raw';
import { account, reading } from '../test/factories';
import { cumulativeUsage, MAX_IMPORT_BYTES, parseTimestamp, parseUsageImport, planImport, splitCsvLine } from './importers';

const day = (y: number, m: number, d: number) => new Date(y, m - 1, d).getTime();

describe('parseUsageImport: ccusage JSON', () => {
  it('parses the daily array including numeric strings', () => {
    const r = parseUsageImport(fixture);
    expect(r.ok).toBe(true);
    expect(r.format).toBe('ccusage-json');
    expect(r.rows.map((x) => x.tokens)).toEqual([4000, 8000, 12000]);
    expect(r.rows.map((x) => x.dollars)).toEqual([4, 8, 12]);
    expect(r.rows[0]!.start).toBe(day(2026, 1, 5));
    expect(r.rows[0]!.end).toBe(day(2026, 1, 6));
  });

  it('accepts a bare array and snake_case / costUSD fields', () => {
    const r = parseUsageImport(JSON.stringify([{ date: '2026-01-05', total_tokens: 5, costUSD: 1 }]));
    expect(r.ok).toBe(true);
    expect(r.rows[0]).toMatchObject({ tokens: 5, dollars: 1 });
  });

  it('sums token parts when totalTokens is missing and warns', () => {
    const r = parseUsageImport(JSON.stringify({ daily: [{ date: '2026-01-05', inputTokens: 1, outputTokens: 2 }] }));
    expect(r.rows[0]!.tokens).toBe(3);
    expect(r.warnings.join()).toMatch(/summed/);
  });

  it('skips bad entries with a warning and keeps good ones', () => {
    const r = parseUsageImport(
      JSON.stringify({ daily: [{ date: 'not a date', totalTokens: 1 }, { totalTokens: 2 }, { date: '2026-01-05', totalTokens: -4 }, { date: '2026-01-06' }, { date: '2026-01-07', totalTokens: 9 }] }),
    );
    expect(r.ok).toBe(true);
    expect(r.rows).toHaveLength(1);
    expect(r.warnings).toHaveLength(4);
  });

  it('fails clearly on malformed JSON', () => {
    const r = parseUsageImport('{"daily": [');
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/Invalid JSON/);
  });

  it('fails clearly on JSON of the wrong shape', () => {
    const r = parseUsageImport('{"foo": 1}');
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/daily/);
  });

  it('fails when no entries are usable', () => {
    const r = parseUsageImport('{"daily": [{"date": "x"}]}');
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/No usable/);
  });

  it('redirects backup files to settings', () => {
    const r = parseUsageImport(JSON.stringify({ version: 1, accounts: [], readings: [], tags: [] }));
    expect(r.ok).toBe(false);
    expect(r.format).toBe('backup');
  });

  it('rejects empty and oversize input', () => {
    expect(parseUsageImport('   ').error).toMatch(/empty/);
    expect(parseUsageImport('x'.repeat(MAX_IMPORT_BYTES + 1)).error).toMatch(/2 MB/);
  });
});

describe('parseUsageImport: CSV', () => {
  it('parses a headed CSV', () => {
    const r = parseUsageImport('timestamp,tokens,cost\n2026-01-05T10:00:00Z,100,1.5\n2026-01-05T12:00:00Z,200,2.5\n');
    expect(r.ok).toBe(true);
    expect(r.format).toBe('csv');
    expect(r.rows).toHaveLength(2);
    expect(r.rows[0]).toMatchObject({ tokens: 100, dollars: 1.5, start: Date.parse('2026-01-05T10:00:00Z') });
    expect(r.rows[0]!.start).toBe(r.rows[0]!.end);
  });

  it('maps header aliases in any order plus an optional percent column', () => {
    const r = parseUsageImport('Cost USD;Time;Percent Used;Total Tokens\n"$1.00";2026-01-05T10:00:00Z;12%;"1,000"');
    expect(r.ok).toBe(true);
    expect(r.rows[0]).toMatchObject({ dollars: 1, tokens: 1000, percent: 12 });
  });

  it('assumes column order without a header and warns', () => {
    const r = parseUsageImport('1767607200,100,1\n1767610800000,50,0.5');
    expect(r.ok).toBe(true);
    expect(r.rows[0]!.start).toBe(1767607200000);
    expect(r.rows[1]!.start).toBe(1767610800000);
    expect(r.warnings.join()).toMatch(/No header/);
  });

  it('skips malformed rows with line numbers', () => {
    const r = parseUsageImport('timestamp,tokens,cost\nyesterday-ish,1,1\n2026-01-05T10:00:00Z,,\n2026-01-05T11:00:00Z,-5,1\n2026-01-05T12:00:00Z,5,1');
    expect(r.rows).toHaveLength(1);
    expect(r.warnings.map((w) => w.split(':')[0])).toEqual(['Line 2', 'Line 3', 'Line 4']);
  });

  it('fails when the header has no timestamp column', () => {
    const r = parseUsageImport('foo,bar\n1,2');
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/timestamp column/);
  });

  it('fails when the header has no tokens or cost column', () => {
    const r = parseUsageImport('timestamp,notes\n2026-01-05,hi');
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/tokens or cost/);
  });

  it('splits quoted fields with escaped quotes', () => {
    expect(splitCsvLine('a,"b,c","d ""e"""', ',')).toEqual(['a', 'b,c', 'd "e"']);
  });
});

describe('parseTimestamp', () => {
  it('handles day strings, ISO, seconds and milliseconds', () => {
    expect(parseTimestamp('2026-01-05')).toEqual({ start: day(2026, 1, 5), end: day(2026, 1, 6) });
    expect(parseTimestamp('2026-01-05T00:00:00Z')!.start).toBe(Date.UTC(2026, 0, 5));
    expect(parseTimestamp(1767571200)!.start).toBe(1767571200000);
    expect(parseTimestamp('nope')).toBeUndefined();
    expect(parseTimestamp(undefined)).toBeUndefined();
  });
});

describe('cumulativeUsage', () => {
  const rows = parseUsageImport(fixture).rows;
  it('pro-rates partial days', () => {
    const noonDay2 = day(2026, 1, 6) + 12 * 3_600_000;
    expect(cumulativeUsage(rows, day(2026, 1, 5), noonDay2, 'tokens')).toBeCloseTo(4000 + 4000);
  });
  it('returns undefined when nothing overlaps', () => {
    expect(cumulativeUsage(rows, day(2025, 1, 1), day(2025, 1, 2), 'tokens')).toBeUndefined();
  });
});

describe('planImport', () => {
  const rows = parseUsageImport(fixture).rows;

  it('attaches cumulative units to existing readings in the window', () => {
    const acct = account({ resetAt: new Date(day(2026, 1, 5)).toISOString() });
    const r1 = { ...reading(0, 5), at: new Date(day(2026, 1, 6)).toISOString() };
    const r2 = { ...reading(0, 20), at: new Date(day(2026, 1, 8)).toISOString() };
    const plan = planImport(rows, acct, [r1, r2]);
    expect(plan.creates).toEqual([]);
    expect(plan.updates.map((u) => u.tokens)).toEqual([4000, 24000]);
    expect(plan.updates.map((u) => u.dollars)).toEqual([4, 24]);
  });

  it('creates readings from CSV rows with percent', () => {
    const csv = parseUsageImport('timestamp,tokens,percent\n2026-01-05T10:00:00Z,100,10\n2026-01-05T12:00:00Z,100,20');
    const plan = planImport(csv.rows, account({ windowType: 'weekly-rolling' }), []);
    expect(plan.creates.map((c) => [c.percentUsed, c.tokens])).toEqual([[10, 100], [20, 200]]);
  });

  it('explains when there is nothing to match', () => {
    const plan = planImport(rows, account(), []);
    expect(plan.updates).toEqual([]);
    expect(plan.notes.join()).toMatch(/no percent readings/);
  });

  it('flags readings outside the imported range as partial', () => {
    const r = { ...reading(0, 5), at: new Date(day(2026, 1, 20)).toISOString() };
    const plan = planImport(rows, account({ windowType: 'weekly-rolling' }), [r]);
    expect(plan.updates[0]?.partial ?? true).toBe(true);
  });
});
