'use client';

import * as React from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/shared/ui/button';
import { Alert } from '@/shared/ui/alert';
import { PasswordField } from '@/shared/ui/password-field';
import { resetPassword } from '@/lib/auth/api';
import { ApiError } from '@/shared/api/client';
import { AUTH_MESSAGES } from '@/lib/auth/messages';

const schema = z
  .object({
    password: z
      .string()
      .min(12, 'Slaptažodis turi būti bent 12 simbolių')
      .max(128, 'Slaptažodis per ilgas'),
    confirm: z.string().min(1, 'Pakartokite slaptažodį'),
  })
  .refine((values) => values.password === values.confirm, {
    path: ['confirm'],
    message: 'Slaptažodžiai nesutampa',
  });

type Values = z.infer<typeof schema>;

type State =
  | { kind: 'idle' }
  | { kind: 'success' }
  | { kind: 'missing' }
  | { kind: 'invalid' }
  | { kind: 'expired' }
  | { kind: 'used' }
  | { kind: 'error' };

export function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [state, setState] = React.useState<State>(() =>
    token ? { kind: 'idle' } : { kind: 'missing' },
  );

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema) });

  const submit = handleSubmit(async (values) => {
    if (!token) {
      setState({ kind: 'missing' });
      return;
    }
    try {
      await resetPassword(token, values.password);
      window.history.replaceState(null, '', window.location.pathname);
      setState({ kind: 'success' });
    } catch (error) {
      if (error instanceof ApiError && error.status === 410) {
        setState({ kind: 'expired' });
      } else if (error instanceof ApiError && error.status === 409) {
        setState({ kind: 'used' });
      } else if (error instanceof ApiError && error.status === 400) {
        setState({ kind: 'invalid' });
      } else {
        setState({ kind: 'error' });
      }
    }
  });

  if (state.kind === 'success') {
    return (
      <div className="space-y-4">
        <Alert variant="success">Slaptažodis pakeistas. Dabar galite prisijungti.</Alert>
        <Link
          href="/prisijungti"
          className="inline-flex h-10 w-full items-center justify-center rounded-md bg-chocolate px-4 text-sm font-medium text-ivory hover:bg-[#3f2114]"
        >
          Prisijungti
        </Link>
      </div>
    );
  }

  if (state.kind !== 'idle') {
    const message =
      state.kind === 'missing'
        ? 'Trūksta atkūrimo nuorodos parametro.'
        : state.kind === 'expired'
          ? AUTH_MESSAGES.expiredToken
          : state.kind === 'used'
            ? AUTH_MESSAGES.usedToken
            : state.kind === 'invalid'
              ? AUTH_MESSAGES.invalidToken
              : AUTH_MESSAGES.network;
    return (
      <div className="space-y-4">
        <Alert variant="error">{message}</Alert>
        <Link
          href="/pamirsau-slaptazodi"
          className="inline-flex h-10 w-full items-center justify-center rounded-md border border-border bg-white px-4 text-sm font-medium text-ink hover:bg-cream/40"
        >
          Prašyti naujos nuorodos
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <PasswordField
        id="password"
        label="Naujas slaptažodis"
        autoComplete="new-password"
        autoFocus
        hint="Bent 12 simbolių."
        error={errors.password?.message}
        {...register('password')}
      />
      <PasswordField
        id="confirm"
        label="Pakartokite naują slaptažodį"
        autoComplete="new-password"
        error={errors.confirm?.message}
        {...register('confirm')}
      />
      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? 'Keičiama…' : 'Pakeisti slaptažodį'}
      </Button>
    </form>
  );
}
