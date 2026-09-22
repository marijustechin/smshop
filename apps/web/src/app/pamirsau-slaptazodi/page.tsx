import type { Metadata } from 'next';
import Link from 'next/link';
import { PageShell } from '@/shared/ui/page-shell';
import { ForgotPasswordForm } from './forgot-password-form';

export const metadata: Metadata = { title: 'Pamiršau slaptažodį — Šokolado meistrai' };

export default function ForgotPasswordPage() {
  return (
    <PageShell
      title="Pamiršau slaptažodį"
      description="Įveskite savo el. pašto adresą ir išsiųsime atkūrimo nuorodą."
      footer={
        <Link href="/prisijungti" className="text-chocolate underline-offset-2 hover:underline">
          Grįžti į prisijungimą
        </Link>
      }
    >
      <ForgotPasswordForm />
    </PageShell>
  );
}
