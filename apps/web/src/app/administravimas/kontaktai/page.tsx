import type { Metadata } from 'next';
import { AdminContactsView } from '@/widgets/admin';

export const metadata: Metadata = { title: 'Kontaktai — Administravimas' };

export default function AdminContactsPage() {
  return <AdminContactsView />;
}
