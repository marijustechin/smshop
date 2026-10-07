import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/**
 * Tag creation input. Employees type only a human name; the normalized slug is
 * derived server-side (`Šokoladas` -> `sokoladas`). The visual `#` is never
 * part of the stored name.
 */
export const createCatalogTagSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
  })
  .strict();

export class CreateCatalogTagDto extends createZodDto(createCatalogTagSchema) {}
