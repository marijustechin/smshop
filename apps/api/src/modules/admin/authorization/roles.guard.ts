import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { User } from '@smshop/db';
import { PrismaService } from '../../prisma/prisma.service.js';
import { toUserRole, type UserRole } from '../../auth/roles/user-role.js';
import type { AuthenticatedRequest } from '../../auth/session/access-token.guard.js';
import { ROLES_KEY } from './roles.decorator.js';

export interface RoleAuthenticatedRequest extends AuthenticatedRequest {
  /** The full user row loaded while evaluating the required role. */
  authUser?: User;
}

/**
 * Server-side role enforcement. Must run after `AccessTokenGuard` (it reads
 * `request.identity`). The role is loaded from the database on every protected
 * request rather than trusted from the short-lived access token, so a role
 * change or account deletion takes effect immediately and a stale token cannot
 * retain admin access. When a role is required the loaded user is attached for
 * `@CurrentUser()`.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<UserRole[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RoleAuthenticatedRequest>();
    const userId = request.identity?.userId;
    if (!userId) {
      throw new UnauthorizedException('Missing authenticated identity');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('Invalid access token');
    }

    request.authUser = user;
    if (!required.includes(toUserRole(user.role))) {
      throw new ForbiddenException({
        statusCode: 403,
        code: 'INSUFFICIENT_ROLE',
        message: 'You do not have access to this resource',
      });
    }

    return true;
  }
}
