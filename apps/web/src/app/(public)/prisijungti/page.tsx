import { Suspense } from 'react';
import type { Metadata } from 'next';
import { PageShell } from '@/shared/ui/page-shell';
import { LoginForm, LoginFooter, RedirectIfAuthenticated } from '@/features/auth';

export const metadata: Metadata = { title: 'Prisijungti — Šokolado meistrai' };

export default function LoginPage() {
  return (
    <PageShell title="Prisijungti" footer={<LoginFooter />}>
      <RedirectIfAuthenticated>
        <Suspense fallback={<p className="text-sm text-text-muted">Kraunama…</p>}>
          <LoginForm />
        </Suspense>
      </RedirectIfAuthenticated>
    </PageShell>
  );
}
