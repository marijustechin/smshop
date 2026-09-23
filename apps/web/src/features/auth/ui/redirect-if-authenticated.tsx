'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../model/auth-context';

/**
 * Keeps authenticated users away from guest-only forms (login, registration).
 * While the session is unresolved it renders a small placeholder so the form is
 * never flashed before a redirect; once confirmed authenticated it replaces the
 * route with the account page. Guest and transient-error states render their
 * children unchanged.
 */
export function RedirectIfAuthenticated({
  children,
  to = '/paskyra',
}: {
  children: React.ReactNode;
  to?: string;
}) {
  const { status } = useAuth();
  const router = useRouter();

  React.useEffect(() => {
    if (status === 'authenticated') {
      router.replace(to);
    }
  }, [status, router, to]);

  if (status === 'unknown') {
    return <p className="text-sm text-text-muted">Kraunama…</p>;
  }
  if (status === 'authenticated') {
    return <p className="text-sm text-text-muted">Nukreipiama…</p>;
  }
  return <>{children}</>;
}
