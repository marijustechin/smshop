'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/shared/ui/button';
import { Alert } from '@/shared/ui/alert';
import { useAuth, getAuthCapabilities } from '@/features/auth';

export function AccountClient() {
  const { status, user, logout, bootstrap } = useAuth();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = React.useState(false);
  const [retrying, setRetrying] = React.useState(false);
  const [googleEnabled, setGoogleEnabled] = React.useState(false);

  React.useEffect(() => {
    // Only a *confirmed* unauthenticated state redirects to login. A transient
    // bootstrap/error state must never be treated as logout.
    if (status === 'unauthenticated') {
      router.replace('/prisijungti?returnTo=/paskyra');
    }
  }, [status, router]);

  React.useEffect(() => {
    let cancelled = false;
    getAuthCapabilities()
      .then((capabilities) => {
        if (!cancelled) {
          setGoogleEnabled(capabilities.google);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setGoogleEnabled(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const onRetry = async () => {
    setRetrying(true);
    try {
      await bootstrap();
    } finally {
      setRetrying(false);
    }
  };

  if (status === 'error') {
    return (
      <div className="space-y-4">
        <Alert variant="error">
          Nepavyko patikrinti prisijungimo būsenos. Tai gali būti laikinas ryšio sutrikimas.
        </Alert>
        <Button variant="outline" onClick={onRetry} disabled={retrying}>
          {retrying ? 'Bandoma…' : 'Bandyti dar kartą'}
        </Button>
      </div>
    );
  }

  // Avoid rendering protected content before the session is known.
  if (status !== 'authenticated' || !user) {
    return <p className="text-sm text-text-muted">Kraunama…</p>;
  }

  const onLogout = async () => {
    setLoggingOut(true);
    await logout();
    router.replace('/');
  };

  return (
    <div className="space-y-5">
      <dl className="space-y-2 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-text-muted">El. paštas</dt>
          <dd className="font-medium text-text">{user.email}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-text-muted">El. pašto būsena</dt>
          <dd className="font-medium text-text">
            {user.emailVerified ? 'Patvirtintas' : 'Nepatvirtintas'}
          </dd>
        </div>
        {googleEnabled ? (
          <div className="flex justify-between gap-4">
            <dt className="text-text-muted">Google paskyra</dt>
            <dd className="font-medium text-text">{user.googleLinked ? 'Susieta' : 'Nesusieta'}</dd>
          </div>
        ) : null}
        {process.env.NODE_ENV !== 'production' ? (
          <>
            <div className="flex justify-between gap-4">
              <dt className="text-text-muted">Vartotojo ID</dt>
              <dd className="font-mono text-xs text-text">{user.id}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-text-muted">Sesijos būsena</dt>
              <dd className="font-mono text-xs text-text">{status}</dd>
            </div>
          </>
        ) : null}
      </dl>

      {!user.emailVerified ? (
        <Alert variant="info">
          Patvirtinkite el. pašto adresą, kad galėtumėte naudotis visomis funkcijomis.
        </Alert>
      ) : null}

      <div className="flex gap-3">
        <Button variant="outline" onClick={onLogout} disabled={loggingOut}>
          {loggingOut ? 'Atsijungiama…' : 'Atsijungti'}
        </Button>
        <Link
          href="/"
          className="inline-flex h-10 items-center justify-center rounded-md px-4 text-sm font-medium text-primary hover:bg-surface-muted"
        >
          Į parduotuvę
        </Link>
      </div>
    </div>
  );
}
