import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { CONTACT_TOPICS } from '../contact-form.topics.js';

/**
 * Public contact-form input. Strict: unknown fields are rejected. Bounds are
 * enforced server-side (the message cap is the meaningful payload bound; JSON
 * bodies are additionally bounded by the Fastify body limit).
 */
export const submitContactFormSchema = z
  .object({
    topic: z.enum(CONTACT_TOPICS),
    email: z
      .string()
      .trim()
      .min(1, 'Įveskite el. paštą')
      .max(254)
      .pipe(z.email('Neteisingas el. pašto formatas')),
    message: z
      .string()
      .trim()
      .min(1, 'Įveskite žinutę')
      .max(5000, 'Žinutė negali viršyti 5000 simbolių'),
    name: z.string().trim().max(100, 'Vardas negali viršyti 100 simbolių').optional(),
    phone: z.string().trim().max(50, 'Telefonas negali viršyti 50 simbolių').optional(),
    turnstileToken: z.string().min(1).max(4096).optional(),
  })
  .strict();

export class SubmitContactFormDto extends createZodDto(submitContactFormSchema) {}
