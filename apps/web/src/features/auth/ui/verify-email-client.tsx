'use client';

import * as React from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Alert } from '@/shared/ui/alert';
import { verifyEmail } from '../api/auth-api';
import { ApiError } from '@/shared/api/client';
import { AUTH_MESSAGES } from '../model/messages';

type VerificationState =
  | { kind: 'verifying' }
  | { kind: 'success' }
  | { kind: 'missing' }
  | { kind: 'invalid' }
  | { kind: 'expired' }
  | { kind: 'used' }
  | { kind: 'error' };

// Module-level in-flight guard: ensures the same token is never consumed twice
// across React effect re-execution or remounts.
const inFlight = new Map<string, Promise<void>>();

function verifyOnce(token: string): Promise<void> {
  const existing = inFlight.get(token);
  if (existing) {
    return existing;
  }
  const promise = verifyEmail(token)
    .then(() => undefined)
    .catch((error: unknown) => {
      // Allow a retry after a failure; keep successful results cached so a
      // remount cannot consume the same token twice.
      inFlight.delete(token);
      throw error;
    });
  inFlight.set(token, promise);
  return promise;
}

export function VerifyEmailClient() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [state, setState] = React.useState<VerificationState>(() =>
    token ? { kind: 'verifying' } : { kind: 'missing' },
  );
  const started = React.useRef(false);

  React.useEffect(() => {
    if (started.current || !token) {
      return;
    }
    started.current = true;

    // Clean the one-time token from the URL/history as soon as it is read.
    window.history.replaceState(null, '', window.location.pathname);

    void verifyOnce(token).then(
      () => setState({ kind: 'success' }),
      (error) => {
        if (error instanceof ApiError && error.status === 410) {
          setState({ kind: 'expired' });
        } else if (error instanceof ApiError && error.status === 409) {
          setState({ kind: 'used' });
        } else if (error instanceof ApiError && error.status === 400) {
          setState({ kind: 'invalid' });
        } else {
          setState({ kind: 'error' });
        }
      },
    );
  }, [token]);

  if (state.kind === 'verifying') {
    return <p className="text-sm text-muted">Tikrinamas el. pašto adresas…</p>;
  }

  if (state.kind === 'success') {
    return (
      <div className="space-y-4">
        <Alert variant="success">El. pašto adresas patvirtintas. Dabar galite prisijungti.</Alert>
        <Link
          href="/prisijungti"
          className="inline-flex h-10 w-full items-center justify-center rounded-md bg-chocolate px-4 text-sm font-medium text-ivory hover:bg-[#3f2114]"
        >
          Prisijungti
        </Link>
      </div>
    );
  }

  const message =
    state.kind === 'missing'
      ? 'Trūksta patvirtinimo nuorodos parametro.'
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
      <p className="text-sm text-muted">
        Galite paprašyti naujo patvirtinimo laiško prisijungimo puslapyje.
      </p>
      <Link
        href="/prisijungti"
        className="inline-flex h-10 w-full items-center justify-center rounded-md border border-border bg-white px-4 text-sm font-medium text-ink hover:bg-cream/40"
      >
        Prisijungti
      </Link>
    </div>
  );
}
