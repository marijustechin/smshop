import { Suspense } from 'react';
import type { Metadata } from 'next';
import { PageShell } from '@/shared/ui/page-shell';
import { LoginForm, LoginFooter } from './login-form';

export const metadata: Metadata = { title: 'Prisijungti — Šokolado meistrai' };

export default function LoginPage() {
  return (
    <PageShell title="Prisijungti" footer={<LoginFooter />}>
      <Suspense fallback={<p className="text-sm text-muted">Kraunama…</p>}>
        <LoginForm />
      </Suspense>
    </PageShell>
  );
}
