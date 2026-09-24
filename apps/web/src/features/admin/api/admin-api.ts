import type { UserRole } from '@/entities/user';
import type {
  AdminDashboardSummary,
  AdminUser,
  AuthedRequest,
  PaginatedUsers,
} from '../model/types';

/** Typed wrappers around the admin user-management endpoints. */

export function getDashboardSummary(request: AuthedRequest): Promise<AdminDashboardSummary> {
  return request<AdminDashboardSummary>('/api/admin/dashboard/summary');
}

export function listUsers(
  request: AuthedRequest,
  params: { page?: number; pageSize?: number } = {},
): Promise<PaginatedUsers> {
  const search = new URLSearchParams();
  if (params.page) {
    search.set('page', String(params.page));
  }
  if (params.pageSize) {
    search.set('pageSize', String(params.pageSize));
  }
  const query = search.toString();
  return request<PaginatedUsers>(`/api/admin/users${query ? `?${query}` : ''}`);
}

export function updateUserRole(
  request: AuthedRequest,
  id: string,
  role: UserRole,
): Promise<AdminUser> {
  return request<AdminUser>(`/api/admin/users/${encodeURIComponent(id)}/role`, {
    method: 'PATCH',
    body: { role },
  });
}

export function deleteUser(request: AuthedRequest, id: string): Promise<void> {
  return request<void>(`/api/admin/users/${encodeURIComponent(id)}`, { method: 'DELETE' });
}
