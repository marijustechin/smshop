import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { USER_ROLES } from '../../auth/roles/user-role.js';

/** Role change input. Only the three known roles are accepted; unknown roles are rejected. */
export const updateUserRoleSchema = z.object({ role: z.enum(USER_ROLES) }).strict();

export class UpdateUserRoleDto extends createZodDto(updateUserRoleSchema) {}
