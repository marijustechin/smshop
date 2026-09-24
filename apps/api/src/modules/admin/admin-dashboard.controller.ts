import { Controller, Get, UseGuards } from '@nestjs/common';
import { AccessTokenGuard } from '../auth/session/access-token.guard.js';
import { Roles } from './authorization/roles.decorator.js';
import { RolesGuard } from './authorization/roles.guard.js';
import { AdminUsersService, type AdminDashboardSummary } from './admin-users.service.js';

/**
 * Read-only administration dashboard data. Requires a valid access token AND
 * the `admin` role, enforced server-side by the guards.
 */
@Controller('admin/dashboard')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles('admin')
export class AdminDashboardController {
  constructor(private readonly users: AdminUsersService) {}

  @Get('summary')
  summary(): Promise<AdminDashboardSummary> {
    return this.users.getDashboardSummary();
  }
}
