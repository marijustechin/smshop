import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthShell } from '@/components/auth-shell';
import { RegisterForm } from './register-form';

export const metadata: Metadata = { title: 'Registracija — Šokolado meistrai' };

export default function RegisterPage() {
  return (
    <AuthShell
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
    </AuthShell>
  );
}
