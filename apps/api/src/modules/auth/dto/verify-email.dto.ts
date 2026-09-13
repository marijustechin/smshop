import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/** Verification consumes a raw token from the email link. */
export const verifyEmailSchema = z
  .object({
    token: z.string().trim().min(1).max(512),
  })
  .strict();

export class VerifyEmailDto extends createZodDto(verifyEmailSchema) {}
