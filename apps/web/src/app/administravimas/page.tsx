import type { Metadata } from 'next';
import { AdminDashboardView } from '@/widgets/admin';

export const metadata: Metadata = { title: 'Suvestinė — Administravimas' };

export default function AdminIndexPage() {
  return <AdminDashboardView />;
}
