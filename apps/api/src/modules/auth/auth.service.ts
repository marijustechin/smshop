import { ConflictException, Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { EmailVerificationService } from './email-verification/email-verification.service.js';
import type { PasswordHasher } from './password/password-hasher.js';
import { PASSWORD_HASHER } from './password/password-hasher.js';

export interface RegisteredUser {
  id: string;
  email: string;
  emailVerified: boolean;
  verificationEmailSent: boolean;
}

function isUniqueConstraintViolation(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 'P2002'
  );
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(PASSWORD_HASHER) private readonly passwordHasher: PasswordHasher,
    private readonly emailVerification: EmailVerificationService,
  ) {}

  /**
   * Credentials registration. Creates the `User`, its `CREDENTIALS`
   * `AuthAccount`, and an email-verification token atomically. The verification
   * email is sent only after the transaction commits, so a database failure
   * never sends an email while an email-delivery failure still leaves a
   * committed, resendable account. The normalized-email unique constraint is the
   * authoritative duplicate protection (no check-then-insert race).
   */
  async register(input: { email: string; password: string }): Promise<RegisteredUser> {
    const email = input.email.trim();
    const emailNormalized = email.toLowerCase();
    const passwordHash = await this.passwordHasher.hash(input.password);

    let user;
    let rawToken: string;
    try {
      ({ user, rawToken } = await this.prisma.$transaction(async (tx) => {
        const created = await tx.user.create({ data: { email, emailNormalized } });

        await tx.authAccount.create({
          data: {
            userId: created.id,
            provider: 'CREDENTIALS',
            providerAccountId: emailNormalized,
            passwordHash,
          },
        });

        const token = await this.emailVerification.createActiveToken(tx, created.id);
        return { user: created, rawToken: token };
      }));
    } catch (error) {
      if (isUniqueConstraintViolation(error)) {
        throw new ConflictException('Email already in use');
      }
      throw error;
    }

    let verificationEmailSent = false;
    try {
      await this.emailVerification.sendVerificationEmail(user.email, rawToken);
      verificationEmailSent = true;
    } catch {
      this.logger.warn('Verification email delivery failed during registration');
    }

    return {
      id: user.id,
      email: user.email,
      emailVerified: user.emailVerifiedAt !== null,
      verificationEmailSent,
    };
  }
}
