'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/shared/ui/button';
import { Alert } from '@/shared/ui/alert';
import { FormField } from '@/shared/ui/form-field';
import { PasswordField } from '@/shared/ui/password-field';
import { GoogleAuthButton } from './google-auth-button';
import { useAuth } from '../model/auth-context';
import { mapAuthError, isEmailNotVerified, AUTH_MESSAGES } from '../model/messages';
import { safeReturnTo } from '@/shared/lib/return-to';
import { resendVerification } from '../api/auth-api';
import { TurnstileWidget, useTurnstileGate } from '@/shared/ui/turnstile';

const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Įveskite el. paštą')
    .pipe(z.email('Neteisingas el. pašto formatas')),
  password: z.string().min(1, 'Įveskite slaptažodį'),
});

type LoginValues = z.infer<typeof loginSchema>;

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { status, bootstrap, login } = useAuth();
  const [formError, setFormError] = React.useState<string | null>(null);
  const [unverifiedEmail, setUnverifiedEmail] = React.useState<string | null>(null);
  const [resendState, setResendState] = React.useState<'idle' | 'sending' | 'sent' | 'error'>(
    'idle',
  );
  const oauth = searchParams.get('oauth');
  const returnTo = safeReturnTo(searchParams.get('returnTo'));
  const handledOAuth = React.useRef(false);
  const turnstile = useTurnstileGate({
    // A fresh token makes a stale Turnstile error obsolete; unrelated errors stay.
    onTokenAvailable: () => {
      setFormError((current) => (current === AUTH_MESSAGES.turnstile ? null : current));
    },
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema) });

  // OAuth success: establish the session from the refresh cookie, then leave.
  React.useEffect(() => {
    if (oauth !== 'success' || handledOAuth.current) {
      return;
    }
    handledOAuth.current = true;
    void (async () => {
      await bootstrap();
      router.replace(returnTo);
    })();
  }, [oauth, bootstrap, router, returnTo]);

  // OAuth outcome params (`oauth=...`) are non-sensitive and are intentionally
  // left in the URL so the message remains visible; sensitive one-time token
  // params are cleared on the verification/reset pages.

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    setUnverifiedEmail(null);
    // Turnstile tokens are single-use: consume before sending (see register-form).
    const turnstileToken = turnstile.token;
    turnstile.reset();
    try {
      await login(values.email.trim(), values.password, turnstileToken);
      router.replace(returnTo);
    } catch (error) {
      if (isEmailNotVerified(error)) {
        setUnverifiedEmail(values.email.trim());
        setFormError(null);
        return;
      }
      setFormError(mapAuthError(error));
    }
  });

  const onResend = async () => {
    if (!unverifiedEmail) {
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
      await resendVerification(unverifiedEmail, turnstileToken);
      setResendState('sent');
    } catch {
      setResendState('error');
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {oauth === 'failed' ? (
        <Alert variant="error">
          Prisijungti su Google nepavyko. Bandykite dar kartą arba prisijunkite su el. paštu.
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
        autoComplete="current-password"
        error={errors.password?.message}
        {...register('password')}
      />

      {formError ? <Alert variant="error">{formError}</Alert> : null}

      {unverifiedEmail ? (
        <Alert variant="info">
          <p>{AUTH_MESSAGES.emailNotVerified}</p>
          <div className="mt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onResend}
              disabled={resendState === 'sending' || !turnstile.canSubmit}
            >
              {resendState === 'sending' ? 'Siunčiama…' : 'Siųsti patvirtinimo laišką dar kartą'}
            </Button>
            {resendState === 'sent' ? (
              <p className="mt-2 text-xs">
                Jei paskyra tinkama, patvirtinimo laiškas bus išsiųstas.
              </p>
            ) : null}
            {resendState === 'error' ? (
              <p className="mt-2 text-xs">Nepavyko išsiųsti. Bandykite dar kartą.</p>
            ) : null}
          </div>
        </Alert>
      ) : null}

      <TurnstileWidget key={turnstile.nonce} onTokenChange={turnstile.setToken} />

      <Button
        type="submit"
        className="w-full"
        disabled={isSubmitting || status === 'unknown' || !turnstile.canSubmit}
      >
        {isSubmitting ? 'Jungiamasi…' : 'Prisijungti'}
      </Button>

      <GoogleAuthButton label="Prisijungti su Google" />

      <div className="text-center text-sm">
        <Link
          href="/pamirsau-slaptazodi"
          className="text-chocolate underline-offset-2 hover:underline"
        >
          Pamiršau slaptažodį
        </Link>
      </div>
    </form>
  );
}

export function LoginFooter() {
  return (
    <span>
      Pirmą kartą čia?{' '}
      <Link href="/registracija" className="text-chocolate underline-offset-2 hover:underline">
        Užsiregistruoti
      </Link>
    </span>
  );
}
