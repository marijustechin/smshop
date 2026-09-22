import type { Metadata } from 'next';
import Link from 'next/link';
import { PageShell } from '@/shared/ui/page-shell';
import { RegisterForm } from './register-form';

export const metadata: Metadata = { title: 'Registracija — Šokolado meistrai' };

export default function RegisterPage() {
  return (
    <PageShell
      title="Registracija"
      description="Sukurkite paskyrą su el. paštu ir slaptažodžiu."
      footer={
        <span>
          Jau turite paskyrą?{' '}
          <Link href="/prisijungti" className="text-chocolate underline-offset-2 hover:underline">
            Prisijungti
          </Link>
        </span>
      }
    >
      <RegisterForm />
    </PageShell>
  );
}
