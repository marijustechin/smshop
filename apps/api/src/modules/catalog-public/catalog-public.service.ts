import { Injectable, NotFoundException } from '@nestjs/common';
import { ProductScope, ProductStatus } from '@smshop/db';
import { PrismaService } from '../prisma/prisma.service.js';

/** Public rating projection. Present only when a valid imported rating exists. */
export interface PublicCatalogRating {
  average: number;
  count: number;
}

export interface PublicCatalogTag {
  name: string;
  slug: string;
}

/** Public catalogue projection — no administrative, commercial or provenance fields. */
export interface PublicCatalogProduct {
  name: string;
  slug: string;
  description: string;
  primaryImageUrl: string;
  featured: boolean;
  displayOrder: number;
  tags: PublicCatalogTag[];
  rating: PublicCatalogRating | null;
}

export interface PublicCatalogCategory {
  category: { name: string; slug: string };
  products: PublicCatalogProduct[];
}

export interface PublicCatalogProductDetail extends PublicCatalogProduct {
  category: { name: string; slug: string };
}

const PUBLIC_PRODUCT_SELECT = {
  name: true,
  slug: true,
  description: true,
  primaryImageUrl: true,
  featured: true,
  displayOrder: true,
  ratingAverage: true,
  ratingCount: true,
  tags: { select: { name: true, slug: true }, orderBy: { name: 'asc' } },
} as const;

// Featured first, then explicit display order, then a stable tie-breaker.
const PUBLIC_PRODUCT_ORDER = [
  { featured: 'desc' },
  { displayOrder: 'asc' },
  { createdAt: 'asc' },
  { id: 'asc' },
] as const;

interface RawPublicProduct {
  name: string;
  slug: string;
  description: string;
  primaryImageUrl: string;
  featured: boolean;
  displayOrder: number;
  ratingAverage: unknown;
  ratingCount: number | null;
  tags: PublicCatalogTag[];
}

/**
 * A rating is exposed only when both a valid positive score and a positive
 * count exist. `ratingAverage` is a Postgres `numeric(2,1)` value, never a
 * floating-point approximation. `ratingSourceUrl`/`ratingImportedAt` are
 * provenance and stay out of public responses.
 */
function toPublicProduct(product: RawPublicProduct): PublicCatalogProduct {
  const average = product.ratingAverage === null ? null : Number(product.ratingAverage);
  const rating =
    average !== null && Number.isFinite(average) && average > 0 && (product.ratingCount ?? 0) > 0
      ? { average, count: product.ratingCount as number }
      : null;

  return {
    name: product.name,
    slug: product.slug,
    description: product.description,
    primaryImageUrl: product.primaryImageUrl,
    featured: product.featured,
    displayOrder: product.displayOrder,
    tags: product.tags,
    rating,
  };
}

/**
 * Public informational catalogue reads. Only PUBLISHED catalogue products in
 * ACTIVE CATALOG-scope categories are ever exposed; drafts, hidden products,
 * inactive categories and all SHOP-scope data are indistinguishable from
 * nonexistent (404).
 */
@Injectable()
export class CatalogPublicService {
  constructor(private readonly prisma: PrismaService) {}

  async getCategory(slug: string): Promise<PublicCatalogCategory> {
    const category = await this.prisma.category.findFirst({
      where: { slug, scope: ProductScope.CATALOG, isActive: true },
      select: { id: true, name: true, slug: true },
    });
    if (!category) {
      throw new NotFoundException('Category not found');
    }

    const products = await this.prisma.catalogProduct.findMany({
      where: { categoryId: category.id, status: ProductStatus.PUBLISHED },
      orderBy: [...PUBLIC_PRODUCT_ORDER],
      select: PUBLIC_PRODUCT_SELECT,
    });

    return {
      category: { name: category.name, slug: category.slug },
      products: products.map(toPublicProduct),
    };
  }

  async getProduct(slug: string): Promise<PublicCatalogProductDetail> {
    const product = await this.prisma.catalogProduct.findFirst({
      where: {
        slug,
        status: ProductStatus.PUBLISHED,
        category: { scope: ProductScope.CATALOG, isActive: true },
      },
      select: {
        ...PUBLIC_PRODUCT_SELECT,
        category: { select: { name: true, slug: true } },
      },
    });
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    return {
      ...toPublicProduct(product),
      category: product.category,
    };
  }
}
