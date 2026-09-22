'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/shared/ui/button';
import { Alert } from '@/shared/ui/alert';
import { FormField } from '@/shared/ui/form-field';
import { forgotPassword } from '@/lib/auth/api';
import { AUTH_MESSAGES, mapAuthError } from '@/lib/auth/messages';
import { TurnstileWidget, useTurnstileGate } from '@/shared/ui/turnstile';

const schema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Įveskite el. paštą')
    .pipe(z.email('Neteisingas el. pašto formatas')),
});

type Values = z.infer<typeof schema>;

export function ForgotPasswordForm() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema) });
  const [sent, setSent] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const turnstile = useTurnstileGate({
    // A fresh token makes a stale Turnstile error obsolete; unrelated errors stay.
    onTokenAvailable: () => {
      setFormError((current) => (current === AUTH_MESSAGES.turnstile ? null : current));
    },
  });

  const submit = handleSubmit(async (values) => {
    setFormError(null);
    // Turnstile tokens are single-use: consume before sending (see register-form).
    const turnstileToken = turnstile.token;
    turnstile.reset();
    try {
      await forgotPassword(values.email.trim(), turnstileToken);
      setSent(true);
    } catch (error) {
      setFormError(mapAuthError(error));
    }
  });

  if (sent) {
    return (
      <Alert variant="success">
        Jei paskyra su tokiu el. pašto adresu egzistuoja, išsiųsime slaptažodžio atkūrimo
        instrukcijas.
      </Alert>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <FormField
        id="email"
        label="El. paštas"
        type="email"
        autoComplete="email"
        autoFocus
        error={errors.email?.message}
        {...register('email')}
      />
      {formError ? <Alert variant="error">{formError}</Alert> : null}
      <TurnstileWidget key={turnstile.nonce} onTokenChange={turnstile.setToken} />
      <Button type="submit" className="w-full" disabled={isSubmitting || !turnstile.canSubmit}>
        {isSubmitting ? 'Siunčiama…' : 'Siųsti atkūrimo instrukcijas'}
      </Button>
    </form>
  );
}
