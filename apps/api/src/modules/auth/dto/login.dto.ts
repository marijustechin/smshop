import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { PASSWORD_MAX_LENGTH } from '../password/password-policy.js';

/**
 * Login input. Email is normalized at the service boundary. Password bounds are
 * permissive on the minimum (do not leak policy / reject legacy values) but
 * capped on the maximum to protect the hashing boundary.
 */
export const loginSchema = z
  .object({
    email: z.string().trim().max(254).pipe(z.email()),
    password: z.string().min(1).max(PASSWORD_MAX_LENGTH),
    turnstileToken: z.string().min(1).max(4096).optional(),
  })
  .strict();

export class LoginDto extends createZodDto(loginSchema) {}
