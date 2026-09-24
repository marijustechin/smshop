'use client';

import { useAuth } from '@/features/auth';
import { DashboardSummary } from '@/features/admin';

/**
 * Wires the authenticated request function from the auth feature into the admin
 * dashboard, keeping the admin feature auth-agnostic.
 */
export function AdminDashboardView() {
  const { authedRequest } = useAuth();
  return <DashboardSummary request={authedRequest} />;
}
