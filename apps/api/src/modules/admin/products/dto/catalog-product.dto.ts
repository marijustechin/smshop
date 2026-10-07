import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import {
  CATALOG_DESCRIPTION_MAX_LENGTH,
  galleryImageUrlsSchema,
  primaryImageUrlSchema,
  productStatusSchema,
  slugSchema,
} from './common.js';

/** Tag ids attached to a catalogue product. Order is not significant. */
const tagIdsSchema = z.array(z.uuid()).max(20);

export const createCatalogProductSchema = z
  .object({
    categoryId: z.uuid(),
    name: z.string().trim().min(1).max(200),
    slug: slugSchema,
    description: z.string().trim().min(1).max(CATALOG_DESCRIPTION_MAX_LENGTH),
    primaryImageUrl: primaryImageUrlSchema,
    galleryImageUrls: galleryImageUrlsSchema.optional(),
    tagIds: tagIdsSchema.optional(),
    status: productStatusSchema.default('DRAFT'),
    featured: z.boolean().default(false),
    displayOrder: z.coerce.number().int().min(0).default(0),
  })
  .strict();

export class CreateCatalogProductDto extends createZodDto(createCatalogProductSchema) {}

/**
 * Update input. No commercial fields exist on catalogue products by design.
 * Imported legacy rating fields are intentionally absent: they are read-only
 * provenance and can never be employee-edited. Defaults are intentionally
 * omitted so a PATCH never resets unspecified fields.
 */
export const updateCatalogProductSchema = z
  .object({
    categoryId: z.uuid().optional(),
    name: z.string().trim().min(1).max(200).optional(),
    slug: slugSchema.optional(),
    description: z.string().trim().min(1).max(CATALOG_DESCRIPTION_MAX_LENGTH).optional(),
    primaryImageUrl: primaryImageUrlSchema.optional(),
    galleryImageUrls: galleryImageUrlsSchema.optional(),
    tagIds: tagIdsSchema.optional(),
    status: productStatusSchema.optional(),
    featured: z.boolean().optional(),
    displayOrder: z.coerce.number().int().min(0).optional(),
  })
  .strict();

export class UpdateCatalogProductDto extends createZodDto(updateCatalogProductSchema) {}
