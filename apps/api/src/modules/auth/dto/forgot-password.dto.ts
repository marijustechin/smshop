import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/**
 * Forgot-password request. The response is always generic so account existence
 * is never revealed.
 */
export const forgotPasswordSchema = z
  .object({
    email: z.string().trim().max(254).pipe(z.email()),
    turnstileToken: z.string().min(1).max(4096).optional(),
  })
  .strict();

export class ForgotPasswordDto extends createZodDto(forgotPasswordSchema) {}
