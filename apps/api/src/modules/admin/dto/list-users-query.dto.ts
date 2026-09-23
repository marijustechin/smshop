import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/**
 * Admin user-list query. Coerces string query parameters and caps the page size
 * so the list can never be used to dump the whole table in one request.
 */
export const listUsersQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();

export class ListUsersQueryDto extends createZodDto(listUsersQuerySchema) {}
