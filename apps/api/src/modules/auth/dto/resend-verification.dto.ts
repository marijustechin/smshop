import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/**
 * Resend verification request. The email is trimmed and format-checked; the
 * response is always generic so account existence is never revealed.
 */
export const resendVerificationSchema = z
  .object({
    email: z.string().trim().max(254).pipe(z.email()),
    turnstileToken: z.string().min(1).max(4096).optional(),
  })
  .strict();

export class ResendVerificationDto extends createZodDto(resendVerificationSchema) {}
