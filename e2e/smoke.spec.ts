import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

test('load sample data, see a forecast, export JSON, with no outside network traffic', async ({ page }) => {
  const external: string[] = [];
  const cspViolations: string[] = [];
  const errors: string[] = [];
  page.on('request', (r) => {
    const url = new URL(r.url());
    if (!['localhost:4173'].includes(url.host) && !['data:', 'blob:'].includes(url.protocol)) external.push(r.url());
  });
  page.on('console', (m) => {
    if (/Content Security Policy/i.test(m.text())) cspViolations.push(m.text());
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto('/');
  await page.getByRole('button', { name: 'Load sample data' }).click();

  const cards = page.getByTestId('account-card');
  await expect(cards).toHaveCount(3);
  await expect(page.getByTestId('pacing')).toContainText('Send the next job to');
  await expect(page.getByTestId('status-badge').filter({ hasText: 'Will run dry before reset' })).toHaveCount(1);

  await page.getByRole('link', { name: 'Claude Max A' }).click();
  await expect(page.getByTestId('forecast')).toContainText('Burn rate');
  await expect(page.getByTestId('timeline-chart')).toBeVisible();
  await expect(page.getByTestId('pool-estimate')).toContainText('high confidence');

  await page.getByRole('link', { name: 'Settings' }).click();
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export JSON' }).click()]);
  expect(download.suggestedFilename()).toMatch(/^pool-meter-backup-\d{4}-\d{2}-\d{2}\.json$/);
  const data = JSON.parse(readFileSync((await download.path())!, 'utf8'));
  expect(data.version).toBe(1);
  expect(data.accounts).toHaveLength(3);
  expect(data.readings.length).toBeGreaterThan(10);

  expect(external, 'no requests leave the origin').toEqual([]);
  expect(cspViolations).toEqual([]);
  expect(errors).toEqual([]);
});
