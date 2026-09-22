import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { GoogleIdentity } from './google-oidc.provider.js';

export type GoogleResolution =
  | { status: 'authenticated'; userId: string }
  | {
      status: 'invalid';
      reason: 'missing_email' | 'unverified_email' | 'google_already_linked';
    };

function isUniqueConstraintViolation(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 'P2002'
  );
}

type LinkOutcome = { kind: 'ok'; userId: string } | { kind: 'conflict' };

/**
 * Resolves a validated Google identity to a smShop User.
 *
 * Login is intentionally auto-linking:
 * - an existing Google `sub` always maps to its User;
 * - a new `sub` needs a present, Google-verified email;
 * - if a User with the same normalized email exists and holds no different
 *   Google identity, it is linked and logged in — and its email is marked
 *   verified, because Google has proven control of that address (an application
 *   account may have registered the address earlier without verifying it);
 * - otherwise a new User + Google account is created.
 *
 * A Google email is never an authorization to take over a *different* account:
 * a `sub` is never reassigned, and a User that already holds a different Google
 * identity is rejected. Database uniqueness plus a `P2002` re-check make
 * concurrent attempts deterministic.
 */
@Injectable()
export class GoogleAccountService {
  constructor(private readonly prisma: PrismaService) {}

  private findAccountBySub(sub: string) {
    return this.prisma.authAccount.findUnique({
      where: { provider_providerAccountId: { provider: 'GOOGLE', providerAccountId: sub } },
    });
  }

  async resolveIdentity(identity: GoogleIdentity): Promise<GoogleResolution> {
    const existing = await this.findAccountBySub(identity.sub);
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

    let outcome: LinkOutcome;
    try {
      outcome = await this.prisma.$transaction(async (tx): Promise<LinkOutcome> => {
        const user = await tx.user.findUnique({ where: { emailNormalized } });
        if (user) {
          const existingGoogle = await tx.authAccount.findUnique({
            where: { userId_provider: { userId: user.id, provider: 'GOOGLE' } },
          });
          if (existingGoogle) {
            return { kind: 'conflict' };
          }
          await tx.authAccount.create({
            data: { userId: user.id, provider: 'GOOGLE', providerAccountId: identity.sub },
          });
          if (user.emailVerifiedAt === null) {
            await tx.user.update({
              where: { id: user.id },
              data: { emailVerifiedAt: new Date() },
            });
          }
          return { kind: 'ok', userId: user.id };
        }

        const created = await tx.user.create({
          data: { email, emailNormalized, emailVerifiedAt: new Date() },
        });
        await tx.authAccount.create({
          data: { userId: created.id, provider: 'GOOGLE', providerAccountId: identity.sub },
        });
        return { kind: 'ok', userId: created.id };
      });
    } catch (error) {
      if (!isUniqueConstraintViolation(error)) {
        throw error;
      }
      // A concurrent attempt won a unique constraint. Reconcile deterministically.
      const racedSub = await this.findAccountBySub(identity.sub);
      if (racedSub) {
        return { status: 'authenticated', userId: racedSub.userId };
      }

      const racedUser = await this.prisma.user.findUnique({ where: { emailNormalized } });
      if (!racedUser) {
        throw error;
      }
      const racedGoogle = await this.prisma.authAccount.findUnique({
        where: { userId_provider: { userId: racedUser.id, provider: 'GOOGLE' } },
      });
      if (racedGoogle) {
        return { status: 'invalid', reason: 'google_already_linked' };
      }
      try {
        await this.prisma.authAccount.create({
          data: { userId: racedUser.id, provider: 'GOOGLE', providerAccountId: identity.sub },
        });
        if (racedUser.emailVerifiedAt === null) {
          await this.prisma.user.update({
            where: { id: racedUser.id },
            data: { emailVerifiedAt: new Date() },
          });
        }
        return { status: 'authenticated', userId: racedUser.id };
      } catch (retryError) {
        if (!isUniqueConstraintViolation(retryError)) {
          throw retryError;
        }
        const again = await this.findAccountBySub(identity.sub);
        if (again) {
          return { status: 'authenticated', userId: again.userId };
        }
        return { status: 'invalid', reason: 'google_already_linked' };
      }
    }

    if (outcome.kind === 'conflict') {
      return { status: 'invalid', reason: 'google_already_linked' };
    }
    return { status: 'authenticated', userId: outcome.userId };
  }
}
