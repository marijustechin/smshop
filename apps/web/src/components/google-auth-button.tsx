'use client';

import * as React from 'react';
import { getAuthCapabilities, googleStartUrl } from '@/lib/auth/api';

type Availability = 'unknown' | 'available' | 'unavailable';

/**
 * Google OAuth entry point shared by the login and registration pages. It only
 * renders when the backend reports Google as available, so the UI never offers
 * an action the deployed backend cannot perform and a user can never be sent to
 * the raw disabled-provider `503` response. The check fails closed (hidden) if
 * the capability cannot be determined.
 *
 * This is a plain browser navigation to the existing backend OAuth start route
 * (`GET /api/auth/google`); no JS SDK, no JSON fetch, no separate registration
 * flow — the backend creates or logs in the account through the same flow. The
 * caller supplies the context-specific visible label (which is also the
 * accessible name).
 */
export function GoogleAuthButton({ label }: { label: string }) {
  const [availability, setAvailability] = React.useState<Availability>('unknown');

  React.useEffect(() => {
    let cancelled = false;
    getAuthCapabilities()
      .then((capabilities) => {
        if (!cancelled) {
          setAvailability(capabilities.google ? 'available' : 'unavailable');
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAvailability('unavailable');
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (availability !== 'available') {
    return null;
  }

  return (
    <>
      <div className="flex items-center gap-3 text-xs text-muted">
        <span className="h-px flex-1 bg-border" />
        arba
        <span className="h-px flex-1 bg-border" />
      </div>
      <a
        href={googleStartUrl()}
        className="inline-flex h-10 w-full items-center justify-center rounded-md border border-border bg-white text-sm font-medium text-ink hover:bg-cream/40"
      >
        {label}
      </a>
    </>
  );
}
