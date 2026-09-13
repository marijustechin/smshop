import { ForbiddenException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { User } from '@smshop/db';
import { PrismaService } from '../../prisma/prisma.service.js';
import { PASSWORD_HASHER, type PasswordHasher } from '../password/password-hasher.js';
import { AccessTokenService } from './access-token.service.js';
import { generateRefreshToken, hashRefreshToken, parseDurationMs } from './auth-tokens.js';

export interface PublicUser {
  id: string;
  email: string;
  emailVerified: boolean;
}

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  user: PublicUser;
}

export interface RefreshResult {
  accessToken: string;
  refreshToken: string;
}

export interface IssuedSession {
  sessionId: string;
  accessToken: string;
  refreshToken: string;
}

function toPublicUser(user: User): PublicUser {
  return { id: user.id, email: user.email, emailVerified: user.emailVerifiedAt !== null };
}

const INVALID_CREDENTIALS = 'Invalid email or password';

@Injectable()
export class AuthSessionService {
  private dummyHash?: Promise<string>;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(PASSWORD_HASHER) private readonly passwordHasher: PasswordHasher,
    private readonly accessTokens: AccessTokenService,
    private readonly config: ConfigService,
  ) {}

  /** A cached hash used to equalize timing when no credentials hash exists. */
  private getDummyHash(): Promise<string> {
    this.dummyHash ??= this.passwordHasher.hash('timing-equalization-placeholder');
    return this.dummyHash;
  }

  private refreshTtlMs(): number {
    return parseDurationMs(this.config.get<string>('AUTH_SESSION_TTL', '7d'));
  }

  /**
   * Issues exactly one new session for a user, revoking all previously active
   * sessions first (single-active-session policy) and signing an access token.
   * Shared by credentials login and Google authentication.
   */
  async createSession(userId: string): Promise<IssuedSession> {
    const now = new Date();
    const refreshToken = generateRefreshToken();
    const session = await this.prisma.$transaction(async (tx) => {
      await tx.authSession.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: now },
      });
      return tx.authSession.create({
        data: {
          userId,
          refreshTokenHash: hashRefreshToken(refreshToken),
          expiresAt: new Date(now.getTime() + this.refreshTtlMs()),
        },
      });
    });

    const accessToken = await this.accessTokens.sign({ userId, sessionId: session.id });
    return { sessionId: session.id, accessToken, refreshToken };
  }

  /**
   * Credentials login. Unknown email and wrong password are indistinguishable
   * (same generic 401, with an Argon2 verify either way). A valid password on an
   * unverified account is a distinct 403 `EMAIL_NOT_VERIFIED`. Success revokes
   * all active sessions and creates exactly one new session.
   */
  async login(input: { email: string; password: string }): Promise<LoginResult> {
    const emailNormalized = input.email.trim().toLowerCase();

    const user = await this.prisma.user.findUnique({
      where: { emailNormalized },
      include: { accounts: true },
    });
    const credentials = user?.accounts.find((account) => account.provider === 'CREDENTIALS');
    const passwordHash = credentials?.passwordHash ?? (await this.getDummyHash());
    const passwordValid = await this.passwordHasher.verify(passwordHash, input.password);

    if (!user || !credentials?.passwordHash || !passwordValid) {
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }
    if (user.emailVerifiedAt === null) {
      throw new ForbiddenException({
        statusCode: 403,
        code: 'EMAIL_NOT_VERIFIED',
        message: 'Email address is not verified',
      });
    }

    const { accessToken, refreshToken } = await this.createSession(user.id);
    return { accessToken, refreshToken, user: toPublicUser(user) };
  }

  /**
   * Rotates the refresh token for an active session. Rotation is atomic via a
   * conditional update, so only one concurrent refresh can win; a reused old
   * token no longer matches and is rejected.
   */
  async refresh(rawRefreshToken: string): Promise<RefreshResult> {
    const currentHash = hashRefreshToken(rawRefreshToken);
    const session = await this.prisma.authSession.findUnique({
      where: { refreshTokenHash: currentHash },
    });

    if (!session || session.revokedAt !== null || session.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const now = new Date();
    const newRefreshToken = generateRefreshToken();
    const rotated = await this.prisma.authSession.updateMany({
      where: { id: session.id, revokedAt: null, refreshTokenHash: currentHash },
      data: { refreshTokenHash: hashRefreshToken(newRefreshToken), lastUsedAt: now },
    });
    if (rotated.count !== 1) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const accessToken = await this.accessTokens.sign({
      userId: session.userId,
      sessionId: session.id,
    });
    return { accessToken, refreshToken: newRefreshToken };
  }

  /** Revokes the session for the given refresh token. Idempotent and safe. */
  async logout(rawRefreshToken?: string): Promise<void> {
    if (!rawRefreshToken) {
      return;
    }
    await this.prisma.authSession.updateMany({
      where: { refreshTokenHash: hashRefreshToken(rawRefreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async me(userId: string): Promise<PublicUser> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('Invalid access token');
    }
    return toPublicUser(user);
  }
}
