'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { FormField } from '@/components/form-field';
import { forgotPassword } from '@/lib/auth/api';
import { AUTH_MESSAGES } from '@/lib/auth/messages';

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

  const submit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await forgotPassword(values.email.trim());
      setSent(true);
    } catch {
      setFormError(AUTH_MESSAGES.network);
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
      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? 'Siunčiama…' : 'Siųsti atkūrimo instrukcijas'}
      </Button>
    </form>
  );
}
