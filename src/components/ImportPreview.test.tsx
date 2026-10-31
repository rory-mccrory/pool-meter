import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { parseUsageImport, planImport } from '../lib/importers';
import { account } from '../test/factories';
import { ImportPreview } from './ImportPreview';

const acct = account({ windowType: 'weekly-rolling' });

describe('ImportPreview', () => {
  it('shows parsed rows, warnings and planned changes, then confirms', async () => {
    const result = parseUsageImport(
      'timestamp,tokens,cost,percent\n2026-01-05T10:00:00Z,100,1,10\nbad,1,1,1\n2026-01-05T12:00:00Z,300,3,30',
    );
    const plan = planImport(result.rows, acct, []);
    const onConfirm = vi.fn();
    render(<ImportPreview result={result} plan={plan} accountName="Acct" onConfirm={onConfirm} onCancel={() => {}} />);
    expect(screen.getByTestId('row-count')).toHaveTextContent('2');
    expect(within(screen.getByRole('list', { name: 'Import warnings' })).getByText(/Line 3: skipped/)).toBeInTheDocument();
    expect(within(screen.getByRole('table', { name: 'Parsed rows' })).getAllByRole('row')).toHaveLength(3);
    expect(screen.getByTestId('change-summary')).toHaveTextContent('0 readings updated, 2 added.');
    await userEvent.click(screen.getByRole('button', { name: 'Confirm import' }));
    expect(onConfirm).toHaveBeenCalled();
  });

  it('shows an error and disables confirm for malformed input', () => {
    const result = parseUsageImport('{"daily": [');
    render(<ImportPreview result={result} plan={null} onConfirm={() => {}} onCancel={() => {}} />);
    expect(screen.getByRole('alert')).toHaveTextContent(/Invalid JSON/);
    expect(screen.getByRole('button', { name: 'Confirm import' })).toBeDisabled();
  });

  it('disables confirm and explains when nothing matches', () => {
    const result = parseUsageImport('{"daily":[{"date":"2026-01-05","totalTokens":5,"totalCost":1}]}');
    const plan = planImport(result.rows, acct, []);
    render(<ImportPreview result={result} plan={plan} onConfirm={() => {}} onCancel={() => {}} />);
    expect(screen.getByText(/no percent readings/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirm import' })).toBeDisabled();
  });

  it('lists updates to existing readings with old and new values', () => {
    const result = parseUsageImport('timestamp,tokens\n2026-01-05T10:00:00Z,1000\n2026-01-05T11:00:00Z,1000');
    const existing = { id: 'r1', accountId: 'a1', at: '2026-01-05T11:30:00Z', percentUsed: 20, tokens: 500 };
    const plan = planImport(result.rows, acct, [existing]);
    render(<ImportPreview result={result} plan={plan} onConfirm={() => {}} onCancel={() => {}} />);
    const table = screen.getByRole('table', { name: 'Reading updates' });
    expect(within(table).getByText('500 → 2.0k')).toBeInTheDocument();
  });
});
