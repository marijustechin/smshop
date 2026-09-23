import type { Metadata } from 'next';
import { AdminUsersView } from '@/widgets/admin';

export const metadata: Metadata = { title: 'Naudotojai — Administravimas' };

export default function AdminUsersPage() {
  return <AdminUsersView />;
}
