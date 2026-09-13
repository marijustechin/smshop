import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { AccessTokenService, type AuthenticatedIdentity } from './access-token.service.js';

export interface AuthenticatedRequest extends FastifyRequest {
  identity?: AuthenticatedIdentity;
}

/**
 * Verifies the bearer access token and attaches its identity to the request.
 * No database lookup: the short-lived JWT is trusted for its lifetime; session
 * revocation affects refresh immediately and access tokens expire naturally.
 */
@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(private readonly accessTokens: AccessTokenService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const header = request.headers.authorization;

    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing access token');
    }

    try {
      request.identity = await this.accessTokens.verify(header.slice('Bearer '.length));
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }

    return true;
  }
}
