import { Suspense } from 'react';
import type { Metadata } from 'next';
import { AuthShell } from '@/components/auth-shell';
import { LoginForm, LoginFooter } from './login-form';

export const metadata: Metadata = { title: 'Prisijungti — Šokolado meistrai' };

export default function LoginPage() {
  return (
    <AuthShell title="Prisijungti" footer={<LoginFooter />}>
      <Suspense fallback={<p className="text-sm text-muted">Kraunama…</p>}>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
