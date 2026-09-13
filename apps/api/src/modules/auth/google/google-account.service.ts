import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { GoogleIdentity } from './google-oidc.provider.js';

export type GoogleResolution =
  | { status: 'authenticated'; userId: string }
  | { status: 'link_required' }
  | { status: 'invalid'; reason: 'missing_email' | 'unverified_email' };

function isUniqueConstraintViolation(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 'P2002'
  );
}

/**
 * Resolves a validated Google identity to a smShop User.
 *
 * Security: an existing Google `sub` always maps to its User; a new `sub` never
 * attaches to an existing User by email. When the normalized email already
 * belongs to a User, the outcome is `link_required` (no session), even when
 * Google reports the email as verified. Database uniqueness handles races; a
 * uniqueness retry is re-checked and never converts an email collision into an
 * automatic link.
 */
@Injectable()
export class GoogleAccountService {
  constructor(private readonly prisma: PrismaService) {}

  async resolveIdentity(identity: GoogleIdentity): Promise<GoogleResolution> {
    const existing = await this.prisma.authAccount.findUnique({
      where: {
        provider_providerAccountId: {
          provider: 'GOOGLE',
          providerAccountId: identity.sub,
        },
      },
    });
    if (existing) {
      return { status: 'authenticated', userId: existing.userId };
    }

    if (!identity.email) {
      return { status: 'invalid', reason: 'missing_email' };
    }
    if (!identity.emailVerified) {
      return { status: 'invalid', reason: 'unverified_email' };
    }

    const email = identity.email.trim();
    const emailNormalized = email.toLowerCase();

    const collision = await this.prisma.user.findUnique({ where: { emailNormalized } });
    if (collision) {
      return { status: 'link_required' };
    }

    try {
      const user = await this.prisma.$transaction(async (tx) => {
        const created = await tx.user.create({
          data: { email, emailNormalized, emailVerifiedAt: new Date() },
        });
        await tx.authAccount.create({
          data: {
            userId: created.id,
            provider: 'GOOGLE',
            providerAccountId: identity.sub,
          },
        });
        return created;
      });
      return { status: 'authenticated', userId: user.id };
    } catch (error) {
      if (!isUniqueConstraintViolation(error)) {
        throw error;
      }
      // A concurrent creation won. Re-check by `sub` first; if that is not the
      // winner, this was an email collision and must fail closed (no linking).
      const raced = await this.prisma.authAccount.findUnique({
        where: {
          provider_providerAccountId: {
            provider: 'GOOGLE',
            providerAccountId: identity.sub,
          },
        },
      });
      if (raced) {
        return { status: 'authenticated', userId: raced.userId };
      }
      return { status: 'link_required' };
    }
  }
}
