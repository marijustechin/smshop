import { Suspense } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { PageShell } from '@/shared/ui/page-shell';
import { ResetPasswordForm } from '@/features/auth';

export const metadata: Metadata = { title: 'Atkurti slaptažodį — Šokolado meistrai' };

export default function ResetPasswordPage() {
  return (
    <PageShell
      title="Atkurti slaptažodį"
      description="Įveskite naują slaptažodį."
      footer={
        <Link href="/prisijungti" className="text-chocolate underline-offset-2 hover:underline">
          Grįžti į prisijungimą
        </Link>
      }
    >
      <Suspense fallback={<p className="text-sm text-muted">Kraunama…</p>}>
        <ResetPasswordForm />
      </Suspense>
    </PageShell>
  );
}
