'use client';

import { useAuth } from '@/features/auth';
import { ProductsAdmin } from '@/features/products';

/**
 * Wires the authenticated request function from the auth feature into the admin
 * product management UI.
 */
export function AdminProductsView() {
  const { authedRequest } = useAuth();
  return <ProductsAdmin request={authedRequest} />;
}
