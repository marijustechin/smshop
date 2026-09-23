import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { User } from '@smshop/db';
import { AccessTokenGuard } from '../auth/session/access-token.guard.js';
import { CurrentUser } from './authorization/current-user.decorator.js';
import { Roles } from './authorization/roles.decorator.js';
import { RolesGuard } from './authorization/roles.guard.js';
import {
  AdminUsersService,
  type AdminUserSummary,
  type PaginatedUsers,
} from './admin-users.service.js';
import { ListUsersQueryDto } from './dto/list-users-query.dto.js';
import { UpdateUserRoleDto } from './dto/update-user-role.dto.js';

/**
 * Administration user-management API. Every route requires a valid access token
 * AND the `admin` role; authorization is enforced server-side by the guards,
 * never by the client.
 */
@Controller('admin/users')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles('admin')
export class AdminUsersController {
  constructor(private readonly users: AdminUsersService) {}

  @Get()
  list(@Query() query: ListUsersQueryDto): Promise<PaginatedUsers> {
    return this.users.listUsers(query.page, query.pageSize);
  }

  @Patch(':id/role')
  changeRole(
    @CurrentUser() admin: User,
    @Param('id') id: string,
    @Body() dto: UpdateUserRoleDto,
  ): Promise<AdminUserSummary> {
    return this.users.changeRole(admin.id, id, dto.role);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteUser(@CurrentUser() admin: User, @Param('id') id: string): Promise<void> {
    return this.users.deleteUser(admin.id, id);
  }
}
