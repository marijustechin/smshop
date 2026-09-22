import { Suspense } from 'react';
import type { Metadata } from 'next';
import { PageShell } from '@/shared/ui/page-shell';
import { VerifyEmailClient } from '@/features/auth';

export const metadata: Metadata = { title: 'El. pašto patvirtinimas — Šokolado meistrai' };

export default function VerifyEmailPage() {
  return (
    <PageShell title="El. pašto patvirtinimas">
      <Suspense fallback={<p className="text-sm text-muted">Tikrinamas el. pašto adresas…</p>}>
        <VerifyEmailClient />
      </Suspense>
    </PageShell>
  );
}
