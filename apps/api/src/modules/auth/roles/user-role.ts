import { Role as PrismaRole } from '@smshop/db';

/**
 * Wire-format roles exposed by the API and consumed by the web client. The
 * persistence enum (`Role`) uses uppercase database values; the mapping lives
 * here so the contract is defined once and never re-derived ad hoc.
 */
export const USER_ROLES = ['user', 'editor', 'admin'] as const;

export type UserRole = (typeof USER_ROLES)[number];

const PRISMA_BY_USER_ROLE: Record<UserRole, PrismaRole> = {
  user: PrismaRole.USER,
  editor: PrismaRole.EDITOR,
  admin: PrismaRole.ADMIN,
};

const USER_ROLE_BY_PRISMA: Record<PrismaRole, UserRole> = {
  [PrismaRole.USER]: 'user',
  [PrismaRole.EDITOR]: 'editor',
  [PrismaRole.ADMIN]: 'admin',
};

export function toUserRole(role: PrismaRole): UserRole {
  return USER_ROLE_BY_PRISMA[role];
}

export function toPrismaRole(role: UserRole): PrismaRole {
  return PRISMA_BY_USER_ROLE[role];
}

export function isUserRole(value: unknown): value is UserRole {
  return typeof value === 'string' && (USER_ROLES as readonly string[]).includes(value);
}
