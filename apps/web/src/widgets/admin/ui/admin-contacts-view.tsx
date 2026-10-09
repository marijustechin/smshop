'use client';

import { useAuth } from '@/features/auth';
import { ContactsAdmin } from '@/features/contacts';

/**
 * Wires the authenticated request function from the auth feature into the admin
 * contacts management UI (cities, stores and contact groups).
 */
export function AdminContactsView() {
  const { authedRequest } = useAuth();
  return <ContactsAdmin request={authedRequest} />;
}
