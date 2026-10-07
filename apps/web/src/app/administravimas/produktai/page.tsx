import type { Metadata } from 'next';
import { AdminProductsView } from '@/widgets/admin';

export const metadata: Metadata = { title: 'Prekės — Administravimas' };

export default function AdminProductsPage() {
  return <AdminProductsView />;
}
