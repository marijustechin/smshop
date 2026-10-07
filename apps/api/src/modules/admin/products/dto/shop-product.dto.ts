import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import {
  galleryImageUrlsSchema,
  primaryImageUrlSchema,
  productStatusSchema,
  slugSchema,
} from './common.js';

const priceCentsSchema = z.coerce.number().int().min(0);
const stockSchema = z.coerce.number().int().min(0);

export const createShopProductSchema = z
  .object({
    categoryId: z.uuid(),
    name: z.string().trim().min(1).max(200),
    slug: slugSchema,
    shortDescription: z.string().trim().min(1).max(400),
    description: z.string().trim().min(1).max(20000),
    primaryImageUrl: primaryImageUrlSchema,
    galleryImageUrls: galleryImageUrlsSchema.optional(),
    sku: z.string().trim().min(1).max(80).optional(),
    // Money is validated as integer cents; cross-field pricing rules are enforced
    // in the service against the effective values.
    priceCents: priceCentsSchema,
    salePriceCents: priceCentsSchema.optional(),
    saleStartsAt: z.coerce.date().optional(),
    saleEndsAt: z.coerce.date().optional(),
    stockQuantity: stockSchema.default(0),
    status: productStatusSchema.default('DRAFT'),
    featured: z.boolean().default(false),
    displayOrder: z.coerce.number().int().min(0).default(0),
  })
  .strict();

export class CreateShopProductDto extends createZodDto(createShopProductSchema) {}

export const updateShopProductSchema = z
  .object({
    categoryId: z.uuid().optional(),
    name: z.string().trim().min(1).max(200).optional(),
    slug: slugSchema.optional(),
    shortDescription: z.string().trim().min(1).max(400).optional(),
    description: z.string().trim().min(1).max(20000).optional(),
    primaryImageUrl: primaryImageUrlSchema.optional(),
    galleryImageUrls: galleryImageUrlsSchema.optional(),
    sku: z.string().trim().min(1).max(80).nullable().optional(),
    priceCents: priceCentsSchema.optional(),
    salePriceCents: priceCentsSchema.nullable().optional(),
    saleStartsAt: z.coerce.date().nullable().optional(),
    saleEndsAt: z.coerce.date().nullable().optional(),
    stockQuantity: stockSchema.optional(),
    status: productStatusSchema.optional(),
    featured: z.boolean().optional(),
    displayOrder: z.coerce.number().int().min(0).optional(),
  })
  .strict();

export class UpdateShopProductDto extends createZodDto(updateShopProductSchema) {}
