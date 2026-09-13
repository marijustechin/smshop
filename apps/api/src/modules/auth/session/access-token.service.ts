import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

export interface AccessTokenClaims {
  sub: string;
  sid: string;
}

export interface AuthenticatedIdentity {
  userId: string;
  sessionId: string;
}

/**
 * Access-token boundary. Claims are intentionally minimal (`sub` = user id,
 * `sid` = session id); no email, roles, or profile data.
 */
@Injectable()
export class AccessTokenService {
  constructor(private readonly jwt: JwtService) {}

  async sign(identity: AuthenticatedIdentity): Promise<string> {
    return this.jwt.signAsync({ sub: identity.userId, sid: identity.sessionId });
  }

  async verify(token: string): Promise<AuthenticatedIdentity> {
    const payload = await this.jwt.verifyAsync<AccessTokenClaims>(token);
    if (!payload.sub || !payload.sid) {
      throw new Error('Access token is missing required claims');
    }
    return { userId: payload.sub, sessionId: payload.sid };
  }
}
