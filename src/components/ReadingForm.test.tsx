import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ReadingForm } from './ReadingForm';

const NOW = new Date(2026, 0, 5, 10, 30).getTime();

describe('ReadingForm (add reading)', () => {
  it('requires percent used', async () => {
    const onSubmit = vi.fn();
    render(<ReadingForm accountId="a1" now={NOW} onSubmit={onSubmit} />);
    await userEvent.click(screen.getByRole('button', { name: 'Add reading' }));
    expect(screen.getByRole('alert')).toHaveTextContent(/Percent used is required/);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('rejects out-of-range percent and bad optional numbers', async () => {
    const onSubmit = vi.fn();
    render(<ReadingForm accountId="a1" now={NOW} onSubmit={onSubmit} />);
    await userEvent.type(screen.getByLabelText('Percent used *'), '140');
    await userEvent.click(screen.getByRole('button', { name: 'Add reading' }));
    expect(screen.getByRole('alert')).toHaveTextContent(/between 0 and 100/);
    await userEvent.clear(screen.getByLabelText('Percent used *'));
    await userEvent.type(screen.getByLabelText('Percent used *'), '40');
    await userEvent.type(screen.getByLabelText('Tokens'), 'lots');
    await userEvent.click(screen.getByRole('button', { name: 'Add reading' }));
    expect(screen.getByRole('alert')).toHaveTextContent(/Tokens must be/);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits a valid reading with optional fields and resets', async () => {
    const onSubmit = vi.fn();
    render(<ReadingForm accountId="a1" now={NOW} onSubmit={onSubmit} />);
    await userEvent.type(screen.getByLabelText('Percent used *'), '42.5');
    await userEvent.type(screen.getByLabelText('Tokens'), '1,200,000');
    await userEvent.type(screen.getByLabelText('Dollars'), '$18.40');
    await userEvent.type(screen.getByLabelText('Note'), 'after refactor');
    await userEvent.click(screen.getByRole('button', { name: 'Add reading' }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    const r = onSubmit.mock.calls[0]![0];
    expect(r).toMatchObject({ accountId: 'a1', percentUsed: 42.5, tokens: 1_200_000, dollars: 18.4, note: 'after refactor' });
    expect(Date.parse(r.at)).toBe(NOW);
    expect(screen.getByLabelText('Percent used *')).toHaveValue('');
  });

  it('leaves tokens and dollars undefined when blank', async () => {
    const onSubmit = vi.fn();
    render(<ReadingForm accountId="a1" now={NOW} onSubmit={onSubmit} />);
    await userEvent.type(screen.getByLabelText('Percent used *'), '10');
    await userEvent.click(screen.getByRole('button', { name: 'Add reading' }));
    expect(onSubmit.mock.calls[0]![0].tokens).toBeUndefined();
    expect(onSubmit.mock.calls[0]![0].dollars).toBeUndefined();
  });

  it('edits an existing reading keeping its id', async () => {
    const onSubmit = vi.fn();
    const initial = { id: 'r9', accountId: 'a1', at: new Date(NOW).toISOString(), percentUsed: 30 };
    render(<ReadingForm accountId="a1" now={NOW} initial={initial} onSubmit={onSubmit} />);
    const pct = screen.getByLabelText('Percent used *');
    await userEvent.clear(pct);
    await userEvent.type(pct, '35');
    await userEvent.click(screen.getByRole('button', { name: 'Save reading' }));
    expect(onSubmit.mock.calls[0]![0]).toMatchObject({ id: 'r9', percentUsed: 35 });
  });
});
