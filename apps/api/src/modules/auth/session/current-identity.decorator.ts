import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { AuthenticatedIdentity } from './access-token.service.js';
import type { AuthenticatedRequest } from './access-token.guard.js';

/** Injects the identity attached by `AccessTokenGuard`. */
export const CurrentIdentity = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedIdentity => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.identity) {
      throw new Error('CurrentIdentity used without AccessTokenGuard');
    }
    return request.identity;
  },
);
