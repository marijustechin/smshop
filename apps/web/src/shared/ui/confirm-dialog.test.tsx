import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfirmDialog, type ConfirmDialogProps } from './confirm-dialog';

function baseProps(overrides: Partial<ConfirmDialogProps> = {}): ConfirmDialogProps {
  return {
    open: true,
    title: 'Pašalinti naudotoją?',
    description: 'Bus pašalintas naudotojas a@example.com. Šio veiksmo atšaukti negalima.',
    confirmLabel: 'Pašalinti',
    cancelLabel: 'Atšaukti',
    variant: 'destructive',
    isBusy: false,
    error: null,
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
    ...overrides,
  };
}

describe('ConfirmDialog', () => {
  it('renders nothing when closed', () => {
    render(<ConfirmDialog {...baseProps({ open: false })} />);
    expect(screen.queryByTestId('confirm-dialog')).toBeNull();
  });

  it('exposes alertdialog semantics with a labelled title and description', () => {
    render(<ConfirmDialog {...baseProps()} />);

    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(
      within(dialog).getByRole('heading', { name: 'Pašalinti naudotoją?' }),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText(/Bus pašalintas naudotojas a@example\.com\./),
    ).toBeInTheDocument();
    expect(dialog.getAttribute('aria-labelledby')).toBeTruthy();
    expect(dialog.getAttribute('aria-describedby')).toBeTruthy();
  });

  it('moves focus into the dialog on open and traps it there', () => {
    render(<ConfirmDialog {...baseProps()} />);

    const confirm = screen.getByRole('button', { name: 'Pašalinti' });
    expect(confirm).toHaveFocus();

    fireEvent.keyDown(document, { key: 'Tab' });
    expect(screen.getByTestId('confirm-dialog').contains(document.activeElement)).toBe(true);
  });

  it('closes via the cancel button, Escape, and backdrop, and restores focus', async () => {
    const user = userEvent.setup();
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();

    const onCancel = vi.fn();
    const { rerender } = render(<ConfirmDialog {...baseProps({ onCancel })} />);

    await user.click(screen.getByRole('button', { name: 'Atšaukti' }));
    expect(onCancel).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(2);

    await user.click(screen.getByTestId('confirm-dialog-backdrop'));
    expect(onCancel).toHaveBeenCalledTimes(3);

    rerender(<ConfirmDialog {...baseProps({ onCancel, open: false })} />);
    await waitFor(() => expect(trigger).toHaveFocus());

    trigger.remove();
  });

  it('invokes onConfirm only through the confirm action', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<ConfirmDialog {...baseProps({ onConfirm })} />);
    expect(onConfirm).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Pašalinti' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('cannot be dismissed or double-submitted while busy', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(<ConfirmDialog {...baseProps({ isBusy: true, onConfirm, onCancel })} />);

    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('button', { name: 'Pašalinti' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Atšaukti' })).toBeDisabled();

    fireEvent.keyDown(document, { key: 'Escape' });
    await user.click(screen.getByTestId('confirm-dialog-backdrop'));
    expect(onCancel).not.toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('shows a concise error inside the dialog', () => {
    render(<ConfirmDialog {...baseProps({ error: 'Nepavyko pašalinti naudotojo.' })} />);
    expect(screen.getByText('Nepavyko pašalinti naudotojo.')).toBeInTheDocument();
  });
});
