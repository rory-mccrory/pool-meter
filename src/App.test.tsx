import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from './App';
import { STORAGE_KEY } from './lib/storage';
import { StoreProvider } from './state';

describe('App', () => {
  it('loads sample data from the first-run screen and persists it', async () => {
    window.location.hash = '#/';
    render(<StoreProvider><App /></StoreProvider>);
    await userEvent.click(screen.getByRole('button', { name: 'Load sample data' }));
    expect(screen.getAllByTestId('account-card')).toHaveLength(3);
    expect(screen.getByTestId('pacing')).toHaveTextContent(/Send the next job to/);
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(saved.accounts).toHaveLength(3);
  });

  it('adds an account and a reading', async () => {
    window.location.hash = '#/';
    render(<StoreProvider><App /></StoreProvider>);
    await userEvent.click(screen.getByRole('button', { name: 'Add your first account' }));
    await userEvent.type(screen.getByLabelText('Name *'), 'My Plan');
    await userEvent.click(screen.getByRole('button', { name: 'Add account' }));
    expect(await screen.findByRole('heading', { name: 'My Plan' })).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Percent used *'), '12');
    await userEvent.click(screen.getByRole('button', { name: 'Add reading' }));
    expect(screen.getByRole('status')).toHaveTextContent('Reading added.');
    const table = screen.getByRole('table', { name: 'Readings' });
    expect(within(table).getByText('12%')).toBeInTheDocument();
  });
});
