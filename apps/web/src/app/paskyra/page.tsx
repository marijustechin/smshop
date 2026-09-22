import type { Metadata } from 'next';
import { PageShell } from '@/shared/ui/page-shell';
import { AccountClient } from './account-client';

export const metadata: Metadata = { title: 'Paskyra — Šokolado meistrai' };

export default function AccountPage() {
  return (
    <PageShell title="Paskyra" description="Jūsų paskyros informacija.">
      <AccountClient />
    </PageShell>
  );
}
