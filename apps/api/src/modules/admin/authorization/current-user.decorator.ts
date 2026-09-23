import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { User } from '@smshop/db';
import type { RoleAuthenticatedRequest } from './roles.guard.js';

/** Injects the user loaded by `RolesGuard`. Requires `AccessTokenGuard` and `RolesGuard`. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): User => {
    const request = context.switchToHttp().getRequest<RoleAuthenticatedRequest>();
    if (!request.authUser) {
      throw new Error('CurrentUser used without RolesGuard');
    }
    return request.authUser;
  },
);
