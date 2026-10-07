import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/** Lowercase kebab-case slug used by categories and products. */
export const slugSchema = z
  .string()
  .trim()
  .min(1)
  .max(140)
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    'turi būti mažosiomis raidėmis, skaičiais ir brūkšneliais (pvz. sventiniai-tortai)',
  );

/** Validated image URL. A dedicated media library can replace this later. */
export const httpUrlSchema = z
  .string()
  .trim()
  .max(2048)
  .refine(
    (value) => value.startsWith('http://') || value.startsWith('https://'),
    'turi būti http(s) nuoroda',
  );

/**
 * Primary product image reference. Newly uploaded images use the stable
 * application-relative `/media/products/<uuid>.webp` path (so physical storage
 * can later move without changing records); legacy rows keep their absolute
 * `http(s)://` WordPress URLs and remain readable.
 */
export const primaryImageUrlSchema = z
  .string()
  .trim()
  .max(2048)
  .refine(
    (value) =>
      value.startsWith('http://') ||
      value.startsWith('https://') ||
      /^\/media\/products\/[0-9a-f-]{36}\.webp$/.test(value),
    'turi būti http(s) nuoroda arba /media/products/... kelias',
  );

export const galleryImageUrlsSchema = z.array(httpUrlSchema).max(12);

/**
 * Catalogue-only editorial limit. Catalogue full descriptions must stay short
 * enough to sit beside the product image in the two-column detail layout.
 * Deliberately not applied to e-shop products, which keep their own limits.
 */
export const CATALOG_DESCRIPTION_MAX_LENGTH = 1000;

export const PRODUCT_STATUSES = ['DRAFT', 'PUBLISHED', 'HIDDEN'] as const;
export const productStatusSchema = z.enum(PRODUCT_STATUSES);

export const listQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();

export class ListQueryDto extends createZodDto(listQuerySchema) {}
