'use client';

import * as React from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/shared/ui/button';
import { Alert } from '@/shared/ui/alert';
import { FormField } from '@/shared/ui/form-field';
import { PasswordField } from '@/shared/ui/password-field';
import { GoogleAuthButton } from './google-auth-button';
import { register as registerAccount, resendVerification } from '../api/auth-api';
import { ApiError } from '@/shared/api/client';
import { AUTH_MESSAGES, mapAuthError } from '../model/messages';
import { TurnstileWidget, useTurnstileGate } from '@/shared/ui/turnstile';

const registerSchema = z
  .object({
    email: z
      .string()
      .trim()
      .min(1, 'Įveskite el. paštą')
      .pipe(z.email('Neteisingas el. pašto formatas')),
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

type RegisterValues = z.infer<typeof registerSchema>;

export function RegisterForm() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterValues>({ resolver: zodResolver(registerSchema) });

  const [formError, setFormError] = React.useState<string | null>(null);
  const [duplicate, setDuplicate] = React.useState(false);
  const [result, setResult] = React.useState<{ email: string; emailSent: boolean } | null>(null);
  const [resendState, setResendState] = React.useState<'idle' | 'sending' | 'sent' | 'error'>(
    'idle',
  );
  const turnstile = useTurnstileGate({
    // A fresh token makes a stale Turnstile error obsolete; unrelated errors stay.
    onTokenAvailable: () => {
      setFormError((current) => (current === AUTH_MESSAGES.turnstile ? null : current));
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    setDuplicate(false);
    // Turnstile tokens are single-use. Consume the token before the request is
    // sent so a token the server may have consumed can never be resubmitted;
    // the widget immediately starts acquiring a fresh token for any retry.
    const turnstileToken = turnstile.token;
    turnstile.reset();
    try {
      const response = await registerAccount(values.email.trim(), values.password, turnstileToken);
      setResult({ email: values.email.trim(), emailSent: response.verificationEmailSent });
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setDuplicate(true);
        return;
      }
      setFormError(mapAuthError(error));
    }
  });

  const onResend = async () => {
    if (!result) {
      return;
    }
    if (!turnstile.canSubmit) {
      turnstile.reset();
      return;
    }
    const turnstileToken = turnstile.token;
    turnstile.reset();
    setResendState('sending');
    try {
      await resendVerification(result.email, turnstileToken);
      setResendState('sent');
    } catch {
      setResendState('error');
    }
  };

  if (result) {
    return (
      <div className="space-y-4">
        {result.emailSent ? (
          <Alert variant="success">
            Registracija sėkminga. Patikrinkite savo el. paštą ir patvirtinkite adresą.
          </Alert>
        ) : (
          <Alert variant="info">
            <p>
              Paskyra sukurta, tačiau patvirtinimo laiško išsiųsti nepavyko. Galite bandyti išsiųsti
              jį dar kartą.
            </p>
            <div className="mt-2">
              <TurnstileWidget key={turnstile.nonce} onTokenChange={turnstile.setToken} />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onResend}
                disabled={resendState === 'sending' || !turnstile.canSubmit}
              >
                {resendState === 'sending' ? 'Siunčiama…' : 'Siųsti patvirtinimo laišką'}
              </Button>
            </div>
            {resendState === 'sent' ? (
              <p className="mt-2 text-xs">
                Jei paskyra tinkama, patvirtinimo laiškas bus išsiųstas.
              </p>
            ) : null}
          </Alert>
        )}
        <Link
          href="/prisijungti"
          className="inline-flex h-10 w-full items-center justify-center rounded-md bg-chocolate px-4 text-sm font-medium text-ivory hover:bg-[#3f2114]"
        >
          Prisijungti
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {duplicate ? (
        <Alert variant="error">
          <p>{AUTH_MESSAGES.duplicateEmail}</p>
          <Link
            href="/prisijungti"
            className="mt-1 inline-block text-chocolate underline-offset-2 hover:underline"
          >
            Prisijungti
          </Link>
        </Alert>
      ) : null}
      <FormField
        id="email"
        label="El. paštas"
        type="email"
        autoComplete="email"
        autoFocus
        error={errors.email?.message}
        {...register('email')}
      />
      <PasswordField
        id="password"
        label="Slaptažodis"
        autoComplete="new-password"
        hint="Bent 12 simbolių."
        error={errors.password?.message}
        {...register('password')}
      />
      <PasswordField
        id="confirm"
        label="Pakartokite slaptažodį"
        autoComplete="new-password"
        error={errors.confirm?.message}
        {...register('confirm')}
      />
      {formError ? <Alert variant="error">{formError}</Alert> : null}
      <TurnstileWidget key={turnstile.nonce} onTokenChange={turnstile.setToken} />
      <Button type="submit" className="w-full" disabled={isSubmitting || !turnstile.canSubmit}>
        {isSubmitting ? 'Registruojamasi…' : 'Registruotis'}
      </Button>
      <GoogleAuthButton label="Registruotis su Google" />
    </form>
  );
}
