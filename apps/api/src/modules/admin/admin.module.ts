import { Module } from '@nestjs/common';
import { AuthSessionModule } from '../auth/session/auth-session.module.js';
import { AdminUsersController } from './admin-users.controller.js';
import { AdminUsersService } from './admin-users.service.js';
import { RolesGuard } from './authorization/roles.guard.js';
import { InitialAdminBootstrapService } from './bootstrap/initial-admin-bootstrap.service.js';

/**
 * First administration vertical slice: role-guarded user management plus the
 * first-admin bootstrap. `PrismaModule` is global; `AuthSessionModule` supplies
 * the shared `AccessTokenGuard`.
 */
@Module({
  imports: [AuthSessionModule],
  controllers: [AdminUsersController],
  providers: [AdminUsersService, RolesGuard, InitialAdminBootstrapService],
})
export class AdminModule {}
