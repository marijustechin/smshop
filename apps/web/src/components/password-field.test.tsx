import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PasswordField } from './password-field';

describe('PasswordField', () => {
  it('hides the value by default and shows the closed-eye icon', () => {
    render(<PasswordField id="password" label="Slaptažodis" defaultValue="s3cret" />);

    const input = screen.getByLabelText('Slaptažodis');
    expect(input).toHaveAttribute('type', 'password');

    const toggle = screen.getByRole('button', { name: 'Rodyti slaptažodį' });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    expect(toggle.querySelector('.lucide-eye-off')).not.toBeNull();
    expect(toggle.querySelector('.lucide-eye')).toBeNull();
  });

  it('reveals and hides the value without changing it', async () => {
    const user = userEvent.setup();
    render(<PasswordField id="password" label="Slaptažodis" defaultValue="s3cret" />);

    const input = screen.getByLabelText('Slaptažodis');

    await user.click(screen.getByRole('button', { name: 'Rodyti slaptažodį' }));
    expect(input).toHaveAttribute('type', 'text');
    expect(input).toHaveValue('s3cret');

    const hideToggle = screen.getByRole('button', { name: 'Slėpti slaptažodį' });
    expect(hideToggle).toHaveAttribute('aria-pressed', 'true');
    expect(hideToggle.querySelector('.lucide-eye')).not.toBeNull();
    expect(hideToggle.querySelector('.lucide-eye-off')).toBeNull();

    await user.click(hideToggle);
    expect(input).toHaveAttribute('type', 'password');
    expect(input).toHaveValue('s3cret');

    const showToggle = screen.getByRole('button', { name: 'Rodyti slaptažodį' });
    expect(showToggle).toHaveAttribute('aria-pressed', 'false');
    expect(showToggle.querySelector('.lucide-eye-off')).not.toBeNull();
    expect(showToggle.querySelector('.lucide-eye')).toBeNull();
  });

  it('is keyboard operable', async () => {
    const user = userEvent.setup();
    render(<PasswordField id="password" label="Slaptažodis" />);

    const toggle = screen.getByRole('button', { name: 'Rodyti slaptažodį' });
    toggle.focus();
    await user.keyboard('{Enter}');

    expect(screen.getByLabelText('Slaptažodis')).toHaveAttribute('type', 'text');
  });
});
