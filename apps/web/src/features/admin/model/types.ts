import type { UserRole } from '@/entities/user';

/** Safe user-management projection returned by `GET /api/admin/users`. */
export interface AdminUser {
  id: string;
  email: string;
  emailVerified: boolean;
  role: UserRole;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface PaginatedUsers {
  items: AdminUser[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

/** Safe dashboard projection returned by `GET /api/admin/dashboard/summary`. */
export interface AdminDashboardSummary {
  totalUsers: number;
  verifiedUsers: number;
  roleCounts: Record<UserRole, number>;
  recentUsers: AdminUser[];
}

/**
 * Authenticated request function supplied by the auth feature. The admin feature
 * stays auth-agnostic so it respects the FSD-lite layer boundaries; a higher
 * layer (widget) wires `useAuth().authedRequest` into it.
 */
export type AuthedRequest = <T>(
  path: string,
  options?: { method?: string; body?: unknown },
) => Promise<T>;
