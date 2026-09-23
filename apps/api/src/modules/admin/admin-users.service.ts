import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role as PrismaRole, type User } from '@smshop/db';
import { PrismaService } from '../prisma/prisma.service.js';
import { toPrismaRole, toUserRole, type UserRole } from '../auth/roles/user-role.js';

/** Safe user-management projection. Never contains password hashes or tokens. */
export interface AdminUserSummary {
  id: string;
  email: string;
  emailVerified: boolean;
  role: UserRole;
  createdAt: string;
  /** Creation time of the user's most recent session (last successful login). */
  lastLoginAt: string | null;
}

export interface PaginatedUsers {
  items: AdminUserSummary[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

@Injectable()
export class AdminUsersService {
  constructor(private readonly prisma: PrismaService) {}

  private toSummary(user: User, lastLoginAt: Date | null): AdminUserSummary {
    return {
      id: user.id,
      email: user.email,
      emailVerified: user.emailVerifiedAt !== null,
      role: toUserRole(user.role),
      createdAt: user.createdAt.toISOString(),
      lastLoginAt: lastLoginAt ? lastLoginAt.toISOString() : null,
    };
  }

  async listUsers(page: number, pageSize: number): Promise<PaginatedUsers> {
    const take = pageSize;
    const [total, users] = await this.prisma.$transaction([
      this.prisma.user.count(),
      this.prisma.user.findMany({
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * take,
        take,
        include: {
          sessions: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { createdAt: true },
          },
        },
      }),
    ]);

    return {
      items: users.map((user) => this.toSummary(user, user.sessions[0]?.createdAt ?? null)),
      page,
      pageSize: take,
      total,
      totalPages: Math.ceil(total / take),
    };
  }

  /**
   * Changes another user's role. Self-role-change is rejected, and demoting the
   * last administrator is rejected. The check and the update run in one
   * serializable transaction so a concurrent demotion cannot slip past the
   * last-admin safeguard.
   */
  async changeRole(
    actingUserId: string,
    targetUserId: string,
    role: UserRole,
  ): Promise<AdminUserSummary> {
    if (targetUserId === actingUserId) {
      throw new ForbiddenException({
        statusCode: 403,
        code: 'CANNOT_CHANGE_OWN_ROLE',
        message: 'Administrators cannot change their own role',
      });
    }

    const nextRole = toPrismaRole(role);
    return this.prisma.$transaction(
      async (tx) => {
        const target = await tx.user.findUnique({ where: { id: targetUserId } });
        if (!target) {
          throw new NotFoundException('User not found');
        }
        if (target.role !== nextRole && target.role === PrismaRole.ADMIN) {
          await this.assertAnotherAdminExists(tx, targetUserId);
        }

        const updated =
          target.role === nextRole
            ? target
            : await tx.user.update({ where: { id: targetUserId }, data: { role: nextRole } });

        const lastSession = await tx.authSession.findFirst({
          where: { userId: targetUserId },
          orderBy: { createdAt: 'desc' },
          select: { createdAt: true },
        });
        return this.toSummary(updated, lastSession?.createdAt ?? null);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  /**
   * Deletes a user. Self-deletion and deleting the last administrator are
   * rejected. Related auth records are removed by the schema's cascade, so the
   * email becomes available for registration again.
   */
  async deleteUser(actingUserId: string, targetUserId: string): Promise<void> {
    if (targetUserId === actingUserId) {
      throw new ForbiddenException({
        statusCode: 403,
        code: 'CANNOT_DELETE_SELF',
        message: 'Administrators cannot delete their own account',
      });
    }

    await this.prisma.$transaction(
      async (tx) => {
        const target = await tx.user.findUnique({ where: { id: targetUserId } });
        if (!target) {
          throw new NotFoundException('User not found');
        }
        if (target.role === PrismaRole.ADMIN) {
          await this.assertAnotherAdminExists(tx, targetUserId);
        }
        await tx.user.delete({ where: { id: targetUserId } });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  /** Fails when removing `excludedUserId` would leave no administrator behind. */
  private async assertAnotherAdminExists(
    tx: Prisma.TransactionClient,
    excludedUserId: string,
  ): Promise<void> {
    const remaining = await tx.user.count({
      where: { role: PrismaRole.ADMIN, id: { not: excludedUserId } },
    });
    if (remaining < 1) {
      throw new ConflictException({
        statusCode: 409,
        code: 'LAST_ADMIN',
        message: 'The last administrator cannot be removed or demoted',
      });
    }
  }
}
