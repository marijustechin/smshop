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
const INVALID_ACCOUNT_MESSAGE = 'Password reset is not available for this account';

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
   * A reset token is issued and a reset email sent only for a verified
   * credentials account. Mail failures are logged, never surfaced.
   */
  async forgotPassword(rawEmail: string): Promise<void> {
    const emailNormalized = rawEmail.trim().toLowerCase();

    const user = await this.prisma.user.findUnique({
      where: { emailNormalized },
      include: { accounts: true },
    });

    const credentials = user?.accounts.find((account) => account.provider === 'CREDENTIALS');
    const eligible =
      user !== null &&
      user.emailVerifiedAt !== null &&
      credentials !== undefined &&
      credentials.passwordHash !== null;

    if (!user || !eligible) {
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
   * Consumes a reset token: re-hashes and stores the new password on the
   * CREDENTIALS account, consumes the token, invalidates remaining reset
   * tokens, and revokes all active sessions — atomically.
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

      const account = await tx.authAccount.findFirst({
        where: { userId: record.userId, provider: 'CREDENTIALS' },
      });
      if (!account || account.passwordHash === null) {
        throw new BadRequestException(INVALID_ACCOUNT_MESSAGE);
      }

      await tx.authAccount.update({
        where: { id: account.id },
        data: { passwordHash },
      });
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
