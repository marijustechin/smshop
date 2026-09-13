import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { PasswordHasher } from './password/password-hasher.js';
import { PASSWORD_HASHER } from './password/password-hasher.js';

export interface RegisteredUser {
  id: string;
  email: string;
  emailVerified: boolean;
}

function isUniqueConstraintViolation(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 'P2002'
  );
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(PASSWORD_HASHER) private readonly passwordHasher: PasswordHasher,
  ) {}

  /**
   * Credentials registration. Creates the `User` and its `CREDENTIALS`
   * `AuthAccount` atomically. The normalized-email unique constraint is the
   * authoritative duplicate protection (no check-then-insert race).
   */
  async register(input: { email: string; password: string }): Promise<RegisteredUser> {
    const email = input.email.trim();
    const emailNormalized = email.toLowerCase();
    const passwordHash = await this.passwordHasher.hash(input.password);

    try {
      const user = await this.prisma.$transaction(async (tx) => {
        const created = await tx.user.create({
          data: { email, emailNormalized },
        });

        await tx.authAccount.create({
          data: {
            userId: created.id,
            provider: 'CREDENTIALS',
            providerAccountId: emailNormalized,
            passwordHash,
          },
        });

        return created;
      });

      return {
        id: user.id,
        email: user.email,
        emailVerified: user.emailVerifiedAt !== null,
      };
    } catch (error) {
      if (isUniqueConstraintViolation(error)) {
        throw new ConflictException('Email already in use');
      }
      throw error;
    }
  }
}
