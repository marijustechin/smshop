import { Suspense } from 'react';
import type { Metadata } from 'next';
import { AuthShell } from '@/components/auth-shell';
import { VerifyEmailClient } from './verify-email-client';

export const metadata: Metadata = { title: 'El. pašto patvirtinimas — Šokolado meistrai' };

export default function VerifyEmailPage() {
  return (
    <AuthShell title="El. pašto patvirtinimas">
      <Suspense fallback={<p className="text-sm text-muted">Tikrinamas el. pašto adresas…</p>}>
        <VerifyEmailClient />
      </Suspense>
    </AuthShell>
  );
}
