import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '../password/password-policy.js';

/**
 * Registration input. Only identity fields are accepted; `.strict()` rejects
 * unknown fields rather than silently stripping them. The email is trimmed and
 * format-checked but keeps its original casing here; normalization to
 * lower-case happens at the persistence boundary in `AuthService`.
 */
export const registerSchema = z
  .object({
    email: z.string().trim().max(254).pipe(z.email()),
    password: z.string().min(PASSWORD_MIN_LENGTH).max(PASSWORD_MAX_LENGTH),
  })
  .strict();

export class RegisterDto extends createZodDto(registerSchema) {}
