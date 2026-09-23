import { SetMetadata } from '@nestjs/common';
import type { UserRole } from '../../auth/roles/user-role.js';

export const ROLES_KEY = 'requiredRoles';

/**
 * Declares the roles allowed to reach a controller or handler. Enforced by
 * `RolesGuard`; it is never a substitute for the guard — hiding UI is not
 * authorization.
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
