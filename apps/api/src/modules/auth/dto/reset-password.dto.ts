import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '../password/password-policy.js';

/** Reset-password request. Reuses the A-002 password policy. */
export const resetPasswordSchema = z
  .object({
    token: z.string().trim().min(1).max(512),
    password: z.string().min(PASSWORD_MIN_LENGTH).max(PASSWORD_MAX_LENGTH),
  })
  .strict();

export class ResetPasswordDto extends createZodDto(resetPasswordSchema) {}
