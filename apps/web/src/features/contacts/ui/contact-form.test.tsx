import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiError } from '@/shared/api/client';
import { submitContactForm } from '../api/contact-form-api';
import { ContactForm } from './contact-form';

vi.mock('../api/contact-form-api', () => ({
  submitContactForm: vi.fn(),
}));

const mockedSubmit = vi.mocked(submitContactForm);

function field(label: string): HTMLInputElement {
  return screen.getByLabelText(label) as HTMLInputElement;
}

async function fillValidForm() {
  const user = userEvent.setup();
  await user.selectOptions(field('Tema'), 'order');
  await user.type(field('El. paštas'), 'visitor@example.test');
  await user.type(field('Žinutė'), 'Labas, turiu klausimą.');
}

beforeEach(() => {
  mockedSubmit.mockReset();
});

describe('ContactForm', () => {
  it('marks the optional fields and validates required ones before sending', async () => {
    const user = userEvent.setup();
    render(<ContactForm />);

    expect(screen.getByLabelText('Vardas (nebūtina)')).toBeInTheDocument();
    expect(screen.getByLabelText('Telefonas (nebūtinas)')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Siųsti žinutę' }));

    expect(
      await screen.findByText('Pasirinkite temą', { selector: '#contact-topic-error' }),
    ).toBeInTheDocument();
    expect(await screen.findByText('Įveskite el. paštą')).toBeInTheDocument();
    expect(await screen.findByText('Įveskite žinutę')).toBeInTheDocument();
    expect(mockedSubmit).not.toHaveBeenCalled();
  });

  it('submits the values and clears the form only after success', async () => {
    mockedSubmit.mockResolvedValue({ message: 'ok' });
    const user = userEvent.setup();
    render(<ContactForm />);

    await fillValidForm();
    await user.type(field('Vardas (nebūtina)'), 'Jonas');
    await user.click(screen.getByRole('button', { name: 'Siųsti žinutę' }));

    expect(await screen.findByText('Ačiū! Jūsų žinutė išsiųsta.')).toBeInTheDocument();
    expect(mockedSubmit).toHaveBeenCalledWith({
      topic: 'order',
      email: 'visitor@example.test',
      message: 'Labas, turiu klausimą.',
      name: 'Jonas',
      phone: undefined,
      turnstileToken: null,
    });
    expect(field('El. paštas').value).toBe('');
    expect((field('Žinutė') as unknown as HTMLTextAreaElement).value).toBe('');
  });

  it('preserves entered values and shows a failure message on error', async () => {
    mockedSubmit.mockRejectedValue(new ApiError(502, 'boom'));
    const user = userEvent.setup();
    render(<ContactForm />);

    await fillValidForm();
    await user.click(screen.getByRole('button', { name: 'Siųsti žinutę' }));

    expect(
      await screen.findByText('Nepavyko išsiųsti žinutės. Bandykite vėliau.'),
    ).toBeInTheDocument();
    expect(field('El. paštas').value).toBe('visitor@example.test');
    expect((field('Žinutė') as unknown as HTMLTextAreaElement).value).toBe(
      'Labas, turiu klausimą.',
    );
  });

  it('prevents repeated clicks while submitting', async () => {
    let resolveSubmit: (value: { message: string }) => void = () => {};
    mockedSubmit.mockReturnValue(
      new Promise<{ message: string }>((resolve) => {
        resolveSubmit = resolve;
      }),
    );
    const user = userEvent.setup();
    render(<ContactForm />);

    await fillValidForm();
    await user.click(screen.getByRole('button', { name: 'Siųsti žinutę' }));

    const pending = await screen.findByRole('button', { name: 'Siunčiama…' });
    expect(pending).toBeDisabled();
    expect(mockedSubmit).toHaveBeenCalledTimes(1);

    resolveSubmit({ message: 'ok' });
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Siųsti žinutę' })).toBeEnabled(),
    );
  });
});
