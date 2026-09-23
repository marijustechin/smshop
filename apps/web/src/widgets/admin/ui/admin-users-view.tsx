'use client';

import { useAuth } from '@/features/auth';
import { UsersManager } from '@/features/admin';

/**
 * Wires the authenticated request function from the auth feature into the
 * admin user-management UI, keeping the admin feature auth-agnostic.
 */
export function AdminUsersView() {
  const { authedRequest, user } = useAuth();
  if (!user) {
    return null;
  }
  return <UsersManager request={authedRequest} currentUserId={user.id} />;
}
