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
import { EMAIL_VERIFICATION_TTL_HOURS } from './email-verification.constants.js';
import { buildVerificationEmail } from './verification-email.js';
import { generateVerificationToken, hashVerificationToken } from './verification-token.js';

export interface VerifyEmailResult {
  verified: true;
}

const INVALID_TOKEN_MESSAGE = 'Invalid verification token';
const USED_TOKEN_MESSAGE = 'Verification token has already been used';
const EXPIRED_TOKEN_MESSAGE = 'Verification token has expired';

@Injectable()
export class EmailVerificationService {
  private readonly logger = new Logger(EmailVerificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(MailService) private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Creates a new active verification token for a user inside an existing
   * transaction, invalidating any previously active tokens first. Returns the
   * raw token (for the email link only); the database stores only its hash.
   */
  async createActiveToken(tx: Prisma.TransactionClient, userId: string): Promise<string> {
    const now = new Date();
    const rawToken = generateVerificationToken();

    await tx.emailVerificationToken.updateMany({
      where: { userId, consumedAt: null },
      data: { consumedAt: now },
    });

    await tx.emailVerificationToken.create({
      data: {
        userId,
        tokenHash: hashVerificationToken(rawToken),
        expiresAt: new Date(now.getTime() + EMAIL_VERIFICATION_TTL_HOURS * 60 * 60 * 1000),
      },
    });

    return rawToken;
  }

  /**
   * Sends the verification email through `MailService`. Throws if mail is not
   * configured or `WEB_ORIGIN` is missing; callers decide how to surface that.
   */
  async sendVerificationEmail(email: string, rawToken: string): Promise<void> {
    const webOrigin = this.config.get<string>('WEB_ORIGIN');
    if (!webOrigin) {
      throw new Error('WEB_ORIGIN is not configured');
    }

    const message = buildVerificationEmail({ webOrigin, token: rawToken });
    await this.mail.send({ to: email, ...message });
  }

  /**
   * Consumes a raw verification token: marks the user verified, consumes the
   * token, and invalidates any remaining active tokens — all atomically.
   * Invalid, expired, and already-consumed tokens are rejected distinctly.
   */
  async verify(rawToken: string): Promise<VerifyEmailResult> {
    const tokenHash = hashVerificationToken(rawToken);

    return this.prisma.$transaction(async (tx) => {
      const record = await tx.emailVerificationToken.findUnique({ where: { tokenHash } });
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
      if (user.emailVerifiedAt === null) {
        await tx.user.update({ where: { id: user.id }, data: { emailVerifiedAt: now } });
      }

      await tx.emailVerificationToken.update({
        where: { id: record.id },
        data: { consumedAt: now },
      });
      await tx.emailVerificationToken.updateMany({
        where: { userId: user.id, consumedAt: null, id: { not: record.id } },
        data: { consumedAt: now },
      });

      return { verified: true };
    });
  }

  /**
   * Issues and sends a fresh verification token when an eligible unverified
   * credentials account exists. Always resolves without revealing account
   * existence; mail failures are logged, not surfaced.
   */
  async resend(rawEmail: string): Promise<void> {
    const emailNormalized = rawEmail.trim().toLowerCase();

    const user = await this.prisma.user.findUnique({
      where: { emailNormalized },
      include: { accounts: true },
    });

    if (!user || user.emailVerifiedAt !== null) {
      return;
    }
    if (!user.accounts.some((account) => account.provider === 'CREDENTIALS')) {
      return;
    }

    const rawToken = await this.prisma.$transaction((tx) => this.createActiveToken(tx, user.id));

    try {
      await this.sendVerificationEmail(user.email, rawToken);
    } catch {
      // Enumeration-safe: never signal a delivery failure to the caller, and
      // never claim a send occurred. A later resend can retry.
      this.logger.warn('Verification email delivery failed for a resend request');
    }
  }
}
