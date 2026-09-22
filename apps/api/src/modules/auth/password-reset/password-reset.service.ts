import {
  BadRequestException,
  ConflictException,
  GoneException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@smshop/db';
import { PrismaService } from '../../prisma/prisma.service.js';
import { MailService } from '../../mail/mail.service.js';
import { PASSWORD_HASHER, type PasswordHasher } from '../password/password-hasher.js';
import { PASSWORD_RESET_TTL_HOURS } from './password-reset.constants.js';
import { buildPasswordResetEmail } from './password-reset-email.js';
import { generatePasswordResetToken, hashPasswordResetToken } from './password-reset-token.js';

export interface ResetPasswordResult {
  passwordReset: true;
}

const INVALID_TOKEN_MESSAGE = 'Invalid password reset token';
const USED_TOKEN_MESSAGE = 'Password reset token has already been used';
const EXPIRED_TOKEN_MESSAGE = 'Password reset token has expired';

function isUniqueConstraintViolation(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 'P2002'
  );
}

@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(MailService) private readonly mail: MailService,
    @Inject(PASSWORD_HASHER) private readonly passwordHasher: PasswordHasher,
    private readonly config: ConfigService,
  ) {}

  /**
   * Creates a new active reset token inside an existing transaction,
   * invalidating previously active reset tokens first. Returns the raw token
   * (for the email link only); the database stores only its hash.
   */
  async createActiveToken(tx: Prisma.TransactionClient, userId: string): Promise<string> {
    const now = new Date();
    const rawToken = generatePasswordResetToken();

    await tx.passwordResetToken.updateMany({
      where: { userId, consumedAt: null },
      data: { consumedAt: now },
    });

    await tx.passwordResetToken.create({
      data: {
        userId,
        tokenHash: hashPasswordResetToken(rawToken),
        expiresAt: new Date(now.getTime() + PASSWORD_RESET_TTL_HOURS * 60 * 60 * 1000),
      },
    });

    return rawToken;
  }

  private async sendResetEmail(email: string, rawToken: string): Promise<void> {
    const webOrigin = this.config.get<string>('WEB_ORIGIN');
    if (!webOrigin) {
      throw new Error('WEB_ORIGIN is not configured');
    }
    const message = buildPasswordResetEmail({ webOrigin, token: rawToken });
    await this.mail.send({ to: email, ...message });
  }

  /**
   * Enumeration-safe forgot-password. For any syntactically valid email it
   * resolves without revealing whether the account exists or was eligible.
   * A reset token is issued and a reset email sent only for a *verified* User;
   * credentials are not required, because a Google-only user uses recovery to
   * create credentials access for the same User. Mail failures are logged,
   * never surfaced.
   */
  async forgotPassword(rawEmail: string): Promise<void> {
    const emailNormalized = rawEmail.trim().toLowerCase();

    const user = await this.prisma.user.findUnique({ where: { emailNormalized } });
    if (!user || user.emailVerifiedAt === null) {
      return;
    }

    const rawToken = await this.prisma.$transaction((tx) => this.createActiveToken(tx, user.id));

    try {
      await this.sendResetEmail(user.email, rawToken);
    } catch {
      // Enumeration-safe: do not signal delivery failure. A later request can
      // rotate and retry. Never claim a send occurred.
      this.logger.warn('Password reset email delivery failed');
    }
  }

  /**
   * Consumes a reset token: stores the new password on the User's CREDENTIALS
   * account (creating it when the User was Google-only), consumes the token,
   * invalidates remaining reset tokens, and revokes all active sessions —
   * atomically. It never creates a second User and never touches other
   * provider accounts.
   */
  async resetPassword(rawToken: string, newPassword: string): Promise<ResetPasswordResult> {
    const tokenHash = hashPasswordResetToken(rawToken);
    const passwordHash = await this.passwordHasher.hash(newPassword);

    return this.prisma.$transaction(async (tx) => {
      const record = await tx.passwordResetToken.findUnique({ where: { tokenHash } });
      if (!record) {
        throw new BadRequestException(INVALID_TOKEN_MESSAGE);
      }
      if (record.consumedAt !== null) {
        throw new ConflictException(USED_TOKEN_MESSAGE);
      }

      const now = new Date();
      if (record.expiresAt.getTime() <= now.getTime()) {
        throw new GoneException(EXPIRED_TOKEN_MESSAGE);
      }

      const user = await tx.user.findUniqueOrThrow({ where: { id: record.userId } });
      const account = await tx.authAccount.findFirst({
        where: { userId: user.id, provider: 'CREDENTIALS' },
      });
      if (account) {
        await tx.authAccount.update({ where: { id: account.id }, data: { passwordHash } });
      } else {
        try {
          await tx.authAccount.create({
            data: {
              userId: user.id,
              provider: 'CREDENTIALS',
              providerAccountId: user.emailNormalized,
              passwordHash,
            },
          });
        } catch (error) {
          if (!isUniqueConstraintViolation(error)) {
            throw error;
          }
          // A concurrent reset created the account for the same User.
          const raced = await tx.authAccount.findFirst({
            where: { userId: user.id, provider: 'CREDENTIALS' },
          });
          if (!raced) {
            throw error;
          }
          await tx.authAccount.update({ where: { id: raced.id }, data: { passwordHash } });
        }
      }
      await tx.passwordResetToken.update({
        where: { id: record.id },
        data: { consumedAt: now },
      });
      await tx.passwordResetToken.updateMany({
        where: { userId: record.userId, consumedAt: null, id: { not: record.id } },
        data: { consumedAt: now },
      });
      await tx.authSession.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: now },
      });

      return { passwordReset: true };
    });
  }
}
