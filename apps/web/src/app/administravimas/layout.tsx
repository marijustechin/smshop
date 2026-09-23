import type { Metadata } from 'next';
import { AdminArea } from '@/widgets/admin';

export const metadata: Metadata = { title: 'Administravimas — Šokolado meistrai' };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminArea>{children}</AdminArea>;
}
