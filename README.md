# Pool Meter

Pool Meter tells you when each of your AI coding plans will run dry.

Vendors such as Anthropic, OpenAI and Cursor show a percent-used bar with weekly or monthly limits, but they don't say how big the allowance is. Pool Meter works from the numbers you log off those dashboards. It:

- **estimates the hidden pool size** in tokens or dollars by fitting your readings,
- **forecasts exhaustion** from a recency-weighted burn rate, and says whether you are **safe**, **tight**, or **will run dry before reset**,
- **flags drain spikes** (intervals burning more than 3× your median) and lets you tag them as idle cache rebuild, agent-to-agent chatter, or other,
- **ranks your accounts** by headroom per hour until reset and says which one should take the next job.

It is a static single-page app. It has no login, no server and no API keys, and nothing leaves your browser.

Other tools such as ccusage, OpenUsage and token-insight read local logs and count tokens. Pool Meter instead calibrates the *undisclosed* pool behind the vendor's percentage and paces work across several accounts. It can also import ccusage output to help that calibration.

## Quick start

```bash
npm install
npm run dev        # http://localhost:5173
```

Open the app and click **Load sample data**. Three demo accounts appear, one each in the safe, tight and dry states, with a calibrated pool, a detected spike and a previous window.

| Script | What it does |
| --- | --- |
| `npm run dev` | Vite dev server |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest unit + component tests |
| `npm run build` | Production build into `dist/` (adds the CSP meta tag) |
| `npm run preview` | Serve `dist/` on port 4173 |
| `npm run e2e` | Playwright smoke test (builds and serves automatically) |

The first time you run `npm run e2e` on a new machine, also run `npx playwright install chromium`.

## Using it

1. **Add an account.** Give it a name, a provider and an optional plan. Choose a window type: weekly rolling, weekly fixed reset, or monthly. Add the next reset time if you know it.
2. **Log readings.** Copy the percent used from the vendor dashboard. Add the tokens or dollars used this window too, if the dashboard shows them. Readings can be edited or deleted from the table.
3. **Import (optional).** Go to Import, then paste or upload `ccusage daily --json` output or a CSV. Check the preview, then confirm. Imported usage is summed into the tokens and dollars of each reading's window, which calibrates the pool.
4. **Read the dashboard.** Each card shows the status, the estimated percent used now, when the plan runs dry, the time to reset and the burn rate. The banner at the top says which account should take the next job, and why.
5. **Tag spikes** on the account page to see what share of your burn goes to cache rebuilds or agent chatter.
6. **Back up** from Settings: export everything as one JSON file and restore it later. You can also clear all data there.

## How the estimate works (plain language)

**Windows.** A plan's usage resets periodically. If percent used drops by **more than 20 points** between two readings, Pool Meter decides a reset happened and starts a new window. If you entered a reset time, it is rolled forward by whole weeks or months to the next boundary after now. Without one, the reset is estimated as one period after the first reading in the current window, and the app shows it as "est."

**Burn rate.** Each pair of consecutive readings in the current window gives a rate in percentage points per hour. The app averages up to the last 8 of these rates. Each one is weighted by how long the interval was, and then by recency with a 24-hour half-life, so a long recent stretch counts most. A single reading on a fixed-reset account is measured from the start of the window instead.

**Forecast.** The app projects forward in a straight line from the last reading at that burn rate:

- *Projected exhaustion* is the time percent used reaches 100.
- **Will run dry**: exhaustion comes before the reset.
- **Tight**: the projection is at least 85% at reset.
- **Safe**: anything lower.

If a reset boundary has passed since your last reading, the new window starts at 0% and the last window's burn rate is reused.

**Pool size.** Suppose readings include tokens or dollars. Then *units = k × percent*, and the app finds *k* with a least-squares fit through the origin (k = Σ(percent·units) / Σ(percent²)). The pool is 100 × k. The confidence label works like this:

- **Low**: fewer than 3 readings, or the readings span less than 10 percentage points.
- **High**: at least 5 readings spanning at least 25 points, with the readings within 10% of the fitted line (RMS error).
- **Medium**: everything else.

With percent-only readings, the burn is shown in percent per hour only.

**Drain flags.** Every interval in every window gets a burn rate. An interval is flagged when its rate is more than 3× the account's median rate. If the median is 0 because readings were mostly idle, the median of the non-zero rates is used instead. At least 3 intervals are needed. Tag totals show the burn in each tag's spikes as a share of the account's total burn.

**Pacing.** *Headroom per hour* = (100 − percent used now) ÷ hours to reset. This is how fast you could spend and still land at exactly 100% at reset, so the account with the most headroom per hour takes the next job. Exhausted accounts and accounts with no readings rank last. Sometimes every account has a medium- or high-confidence pool in the same unit (dollars first, then tokens). In that case headroom is compared in absolute units, because 1% of a big plan is worth more than 1% of a small one.

All of this lives in pure functions in `src/lib/`: `fitPool`, `burnRate`, `forecast`, `detectSpikes`, `rankAccounts`, `splitWindows`, `nextReset`, `parseUsageImport` and `planImport`.

## Import formats (exact assumed schema)

Pasted text and files are limited to **2 MB**. Bad rows are skipped and reported with their entry or line number. If nothing usable is found, the app shows an error. It never fails silently.

### ccusage-style JSON

```json
{
  "daily": [
    { "date": "2026-01-05", "totalTokens": 4000, "totalCost": 4.0 }
  ]
}
```

- **Container:** an object with a `daily` array (`data` or `days` also work), or a bare top-level array.
- **`date`** (required):
  - `YYYY-MM-DD` means one **local calendar day**.
  - A full ISO date-time means a single instant.
- **Tokens:**
  - Taken from `totalTokens` or `total_tokens`.
  - If neither is present, `inputTokens + outputTokens + cacheCreationTokens + cacheReadTokens` is used, with a warning.
- **Cost:** taken from `totalCost`, `total_cost`, `costUSD` or `cost`, in US dollars.
- **Number formats:** values may be numbers or strings such as `"12,000"` or `"$12.00"`. Negative values are rejected.
- An entry needs tokens or cost. Unknown fields are ignored, for example `modelsUsed`, `modelBreakdowns`, and the `totals` block.
- A Pool Meter backup pasted here is detected and you are pointed to Settings.

### CSV

```csv
timestamp,tokens,cost,percent
2026-01-05T09:00:00Z,1200000,18.40,
2026-01-05T15:00:00Z,800000,12.10,31
```

- **Delimiter:** comma, semicolon or tab, detected from the first line.
- **Quoting:** quoted fields and `""` escapes are supported. Blank lines and lines starting with `#` are ignored.
- **Header row** (optional; matching ignores case and punctuation):
  - timestamp: `timestamp|time|date|datetime|at|when` (required)
  - tokens: `tokens|total_tokens|tokens_used|tok`
  - cost: `cost|dollars|usd|total_cost|cost_usd|spend|dollars_used`
  - percent: `percent|pct|percent_used|used_percent|used`
  - At least one of tokens or cost is required.
- **No header:** the columns are read as `timestamp, tokens, cost[, percent]`.
- **Timestamps:**
  - ISO 8601 or any string `Date.parse` accepts.
  - `YYYY-MM-DD` means a whole local day.
  - Bare numbers are Unix epoch seconds, or milliseconds when above 10¹².
- **Values:** `1,234`, `$3.50` and `42%` are accepted.

### How imported rows become readings

Each row's tokens and cost are the usage **during** that row: a day for daily rows, or the period since the previous row for timestamped rows. They are not running totals. For each reading on the target account, the app sums the imported usage from the start of that reading's window up to the reading's time. Day-long rows are pro-rated by how much of the day falls inside that span. The sum becomes the reading's `tokens` and `dollars`, the cumulative figure a dashboard would show. CSV rows that include a `percent` value also create new readings. The preview lists every change before anything is written, including old → new values. A reading is marked "partial" when its window starts before the imported data does.

## Privacy and security

- **No data is transmitted.** All data stays in your browser's `localStorage`, under the key `pool-meter:store` with a versioned schema, and in files you export. There is no backend, no analytics, no telemetry, no third-party script or font, and no API key is ever asked for or stored.
- **This was verified.** The source contains no `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource` or `sendBeacon` calls. The Playwright smoke test (`e2e/smoke.spec.ts`) records every request the page makes while it loads sample data, renders forecasts and exports JSON. It asserts that none leave the page's own origin. The only requests are the app's own HTML, JS, CSS and favicon. The test also asserts there are no CSP violations and no console errors.
- **Strict Content-Security-Policy.** The production build injects a `<meta>` CSP: `default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; font-src 'self'; img-src 'self' data: blob:; object-src 'none'; base-uri 'self'; form-action 'self'`. `vercel.json` and `public/_headers` (for Cloudflare) also send it as an HTTP header with `frame-ancestors 'none'`. Inline scripts and styles are blocked.
- **Import validation.** Imports and backups are validated with Zod and capped at 2 MB. A corrupt `localStorage` entry is never discarded silently: it is moved to `pool-meter:corrupt-backup` and a warning is shown.

## Deploy

Run `npm run build` to produce a fully static `dist/`. Routing uses the URL hash (`#/account/…`), so no server rewrites are needed.

- **Vercel:** import the repo. `vercel.json` sets the build command, the `dist` output, an SPA fallback and the security headers.
- **Cloudflare Pages:**
  - Framework preset "Vite", build command `npm run build`, output directory `dist`.
  - `public/_headers` is copied into `dist/` and applies the CSP and other headers.
- **GitHub Pages:**
  - Build with the repo path as the base: `BASE_PATH=/<repo-name>/ npm run build`.
  - Publish `dist/`, for example with `actions/upload-pages-artifact` + `actions/deploy-pages`.
  - GitHub Pages can't set headers, so the CSP `<meta>` tag is what protects you there (`frame-ancestors` isn't enforced through meta).
- **Any static host:** serve `dist/` as-is.

## Assumptions

1. There was no existing repository, so the project was created in `pool-meter/` with a fresh `git init` on branch `main`. Nothing was pushed.
2. Readings record **cumulative usage for the current window**: percent, tokens and dollars as of that moment, the way a dashboard shows them.
3. Imported ccusage and CSV values are **per-period usage** and are summed into each reading's window (see *How imported rows become readings*). ccusage `date` values are local calendar days.
4. **Rolling weekly windows** are modeled as a reset one week after the first reading of the current window. For imports, a rolling reading's cumulative usage is the imported usage in the 7 days before it.
5. For fixed or monthly accounts with no reset time, imported usage is summed over at most one period (a month counts as 30 days) before the reading, and never past the previous window's last reading.
6. Monthly resets use UTC calendar months, clamped to the end of shorter months (31 Jan → 28/29 Feb).
7. A percent drop of **more than 20 points** (exactly 20 does not count) marks a new window, as the spec says. Smaller drops count as zero burn, since they are usually rounding or rolling decay.
8. Burn rate thresholds are design choices: a 24-hour recency half-life, at most 8 intervals, "tight" at 85% or more projected at reset, and percent shown up to 100.
9. Pool confidence thresholds are also design choices. "Low spread" means under 10 percentage points. "High" needs ≥ 5 readings, ≥ 25 points of spread and ≤ 10% RMS error.
10. Spike detection needs at least 3 intervals. "Account median" means the median over every window of that account. A spike tag is matched to its interval by exact start and end time, so editing a reading's time detaches its tag.
11. "Headroom per hour" is compared in percent unless every account has a medium- or high-confidence pool in the same unit.
12. Restoring a backup **replaces** all data rather than merging, after a confirmation step that shows what the backup contains. **Load sample data** in Settings also replaces all data, with no confirmation step; a note beside the button says to export first.
13. Sample data is generated relative to the current time so it always looks current.
14. Routing uses the URL hash so the app works on GitHub Pages without rewrites. `vercel.json` still has the requested SPA fallback.
15. Charts are hand-written SVG rather than Recharts, which keeps the bundle small and needs no inline styles under the CSP.
16. The CSP is added only to the production build, because Vite's dev server injects inline styles for hot reload.
17. `@playwright/test` is pinned to an exact version so it matches the Chromium build in the development environment. CI installs its own browser.

## Limitations

- Vendors do not disclose their limits, and they can change them, weight models differently, or count cache reads differently. The pool estimate is only as good as your readings. If confidence is low, add more readings spread across the window.
- The forecast is a straight-line projection of recent burn. It can't foresee you starting a big job.
- Dashboards usually round percent to whole numbers, so very short intervals produce noisy rates. Readings a few hours apart work best.
- Rolling windows are approximated as fixed weekly windows. Usage that drops out of a rolling window shows up as flat or negative burn, which is treated as zero.
- Comparing headroom in percent across very different plans can mislead. Calibrate pools in dollars or tokens to get absolute comparisons.
- Data lives in one browser profile. Clearing site data deletes it, so export backups.
- There is no sync between devices. Moving data is done by exporting and importing the JSON file.

## Project layout

```
src/
  model.ts            Account, Reading, SpikeTag, Store + Zod schemas
  lib/                pure logic: fitPool, burnRate, forecast, detectSpikes,
                      rankAccounts, windows, importers, storage, sample, time
  components/         forms, charts, tables, import preview
  pages/              Dashboard, AccountDetail, ImportPage, SettingsPage
  state.tsx           reducer + localStorage persistence
e2e/smoke.spec.ts     Playwright smoke test
```

## License

MIT. See [LICENSE](LICENSE).
