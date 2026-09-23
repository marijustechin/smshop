import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Role as PrismaRole } from '@smshop/db';
import { PrismaService } from '../../prisma/prisma.service.js';

/**
 * Idempotent first-administrator bootstrap.
 *
 * When `AUTH_INITIAL_ADMIN_EMAIL` is set it promotes an **already-existing,
 * email-verified** user whose normalized email exactly matches. It never creates
 * a user and never logs the configured address or any secret. Once the account
 * is an administrator the operation becomes a no-op, so the variable can be
 * removed from the environment after the first successful start.
 */
@Injectable()
export class InitialAdminBootstrapService implements OnModuleInit {
  private readonly logger = new Logger(InitialAdminBootstrapService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.run();
  }

  async run(): Promise<void> {
    const configured = this.config.get<string>('AUTH_INITIAL_ADMIN_EMAIL');
    if (!configured || configured.trim() === '') {
      return;
    }

    const emailNormalized = configured.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { emailNormalized } });

    if (!user) {
      this.logger.warn(
        'AUTH_INITIAL_ADMIN_EMAIL is set but no matching account exists; no promotion performed',
      );
      return;
    }
    if (user.emailVerifiedAt === null) {
      this.logger.warn(
        'AUTH_INITIAL_ADMIN_EMAIL matched an account with an unverified email; no promotion performed',
      );
      return;
    }
    if (user.role === PrismaRole.ADMIN) {
      return;
    }

    await this.prisma.user.update({ where: { id: user.id }, data: { role: PrismaRole.ADMIN } });
    this.logger.log('Promoted the configured initial administrator account');
  }
}
