import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { slugSchema } from './common.js';

export const createCategorySchema = z
  .object({
    name: z.string().trim().min(1).max(140),
    slug: slugSchema,
    // `null`/omitted both mean a root category; an empty string is never valid.
    parentId: z.uuid().nullable().optional(),
    displayOrder: z.coerce.number().int().min(0).default(0),
    isActive: z.boolean().default(true),
  })
  .strict();

export class CreateCategoryDto extends createZodDto(createCategorySchema) {}

export const updateCategorySchema = z
  .object({
    name: z.string().trim().min(1).max(140).optional(),
    slug: slugSchema.optional(),
    // `null` moves the category back to the root.
    parentId: z.uuid().nullable().optional(),
    displayOrder: z.coerce.number().int().min(0).optional(),
    isActive: z.boolean().optional(),
  })
  .strict();

export class UpdateCategoryDto extends createZodDto(updateCategorySchema) {}
