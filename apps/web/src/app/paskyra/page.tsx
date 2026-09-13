import type { Metadata } from 'next';
import { AuthShell } from '@/components/auth-shell';
import { AccountClient } from './account-client';

export const metadata: Metadata = { title: 'Paskyra — Šokolado meistrai' };

export default function AccountPage() {
  return (
    <AuthShell title="Paskyra" description="Jūsų paskyros informacija.">
      <AccountClient />
    </AuthShell>
  );
}
