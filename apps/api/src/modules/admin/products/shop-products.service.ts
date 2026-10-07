import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ProductScope, type ShopProduct } from '@smshop/db';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { CreateShopProductDto, UpdateShopProductDto } from './dto/shop-product.dto.js';

function uniqueTargetText(error: unknown): string | null {
  if (typeof error !== 'object' || error === null) {
    return null;
  }
  const candidate = error as { code?: unknown; meta?: { target?: unknown } };
  if (candidate.code !== 'P2002') {
    return null;
  }
  const target = candidate.meta?.target;
  if (Array.isArray(target)) {
    return target.map(String).join(',');
  }
  return typeof target === 'string' ? target : '';
}

const CATEGORY_SELECT = { select: { id: true, name: true, slug: true } } as const;

export type ShopProductWithCategory = ShopProduct & {
  category: { id: string; name: string; slug: string };
};

export interface PaginatedShopProducts {
  items: ShopProductWithCategory[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

interface PricingShape {
  priceCents: number;
  salePriceCents: number | null;
  saleStartsAt: Date | null;
  saleEndsAt: Date | null;
}

/**
 * E-shop product management. Money is integer cents; sale price must be lower
 * than the base price, sale end cannot precede start, and stock is a
 * non-negative integer. The category must belong to the SHOP scope.
 */
@Injectable()
export class ShopProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(page: number, pageSize: number): Promise<PaginatedShopProducts> {
    const take = pageSize;
    const [total, items] = await this.prisma.$transaction([
      this.prisma.shopProduct.count(),
      this.prisma.shopProduct.findMany({
        orderBy: [{ displayOrder: 'asc' }, { createdAt: 'desc' }],
        skip: (page - 1) * take,
        take,
        include: { category: CATEGORY_SELECT },
      }),
    ]);
    return { items, page, pageSize: take, total, totalPages: Math.ceil(total / take) };
  }

  async create(dto: CreateShopProductDto): Promise<ShopProductWithCategory> {
    await this.assertShopCategory(dto.categoryId);
    await this.assertSkuAvailable(dto.sku ?? null);
    const pricing: PricingShape = {
      priceCents: dto.priceCents,
      salePriceCents: dto.salePriceCents ?? null,
      saleStartsAt: dto.saleStartsAt ?? null,
      saleEndsAt: dto.saleEndsAt ?? null,
    };
    this.assertPricing(pricing);

    try {
      return await this.prisma.shopProduct.create({
        data: {
          categoryId: dto.categoryId,
          name: dto.name,
          slug: dto.slug,
          shortDescription: dto.shortDescription,
          description: dto.description,
          primaryImageUrl: dto.primaryImageUrl,
          galleryImageUrls: dto.galleryImageUrls ?? [],
          sku: dto.sku ?? null,
          priceCents: dto.priceCents,
          salePriceCents: dto.salePriceCents ?? null,
          saleStartsAt: dto.saleStartsAt ?? null,
          saleEndsAt: dto.saleEndsAt ?? null,
          stockQuantity: dto.stockQuantity,
          status: dto.status,
          featured: dto.featured,
          displayOrder: dto.displayOrder,
        },
        include: { category: CATEGORY_SELECT },
      });
    } catch (error) {
      this.rethrowDuplicate(error);
      throw error;
    }
  }

  async update(id: string, dto: UpdateShopProductDto): Promise<ShopProductWithCategory> {
    const existing = await this.prisma.shopProduct.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Product not found');
    }
    if (dto.categoryId !== undefined) {
      await this.assertShopCategory(dto.categoryId);
    }
    if (dto.sku !== undefined) {
      await this.assertSkuAvailable(dto.sku, id);
    }

    // Validate pricing against the effective (merged) values, not only the patch.
    this.assertPricing({
      priceCents: dto.priceCents ?? existing.priceCents,
      salePriceCents:
        dto.salePriceCents !== undefined ? dto.salePriceCents : existing.salePriceCents,
      saleStartsAt: dto.saleStartsAt !== undefined ? dto.saleStartsAt : existing.saleStartsAt,
      saleEndsAt: dto.saleEndsAt !== undefined ? dto.saleEndsAt : existing.saleEndsAt,
    });

    try {
      return await this.prisma.shopProduct.update({
        where: { id },
        data: {
          ...(dto.categoryId !== undefined ? { categoryId: dto.categoryId } : {}),
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.slug !== undefined ? { slug: dto.slug } : {}),
          ...(dto.shortDescription !== undefined ? { shortDescription: dto.shortDescription } : {}),
          ...(dto.description !== undefined ? { description: dto.description } : {}),
          ...(dto.primaryImageUrl !== undefined ? { primaryImageUrl: dto.primaryImageUrl } : {}),
          ...(dto.galleryImageUrls !== undefined ? { galleryImageUrls: dto.galleryImageUrls } : {}),
          ...(dto.sku !== undefined ? { sku: dto.sku } : {}),
          ...(dto.priceCents !== undefined ? { priceCents: dto.priceCents } : {}),
          ...(dto.salePriceCents !== undefined ? { salePriceCents: dto.salePriceCents } : {}),
          ...(dto.saleStartsAt !== undefined ? { saleStartsAt: dto.saleStartsAt } : {}),
          ...(dto.saleEndsAt !== undefined ? { saleEndsAt: dto.saleEndsAt } : {}),
          ...(dto.stockQuantity !== undefined ? { stockQuantity: dto.stockQuantity } : {}),
          ...(dto.status !== undefined ? { status: dto.status } : {}),
          ...(dto.featured !== undefined ? { featured: dto.featured } : {}),
          ...(dto.displayOrder !== undefined ? { displayOrder: dto.displayOrder } : {}),
        },
        include: { category: CATEGORY_SELECT },
      });
    } catch (error) {
      this.rethrowDuplicate(error);
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    const existing = await this.prisma.shopProduct.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Product not found');
    }
    await this.prisma.shopProduct.delete({ where: { id } });
  }

  private assertPricing(pricing: PricingShape): void {
    if (pricing.salePriceCents !== null && pricing.salePriceCents >= pricing.priceCents) {
      throw new BadRequestException({
        statusCode: 400,
        code: 'SALE_PRICE_NOT_LOWER',
        message: 'Sale price must be lower than the base price',
      });
    }
    if (
      pricing.saleStartsAt &&
      pricing.saleEndsAt &&
      pricing.saleEndsAt.getTime() < pricing.saleStartsAt.getTime()
    ) {
      throw new BadRequestException({
        statusCode: 400,
        code: 'SALE_END_BEFORE_START',
        message: 'Sale end date cannot precede the sale start date',
      });
    }
  }

  private async assertSkuAvailable(sku: string | null, excludeId?: string): Promise<void> {
    if (!sku) {
      return;
    }
    const existing = await this.prisma.shopProduct.findFirst({
      where: { sku, ...(excludeId ? { id: { not: excludeId } } : {}) },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException({
        statusCode: 409,
        code: 'SKU_TAKEN',
        message: 'An e-shop product with this SKU already exists',
      });
    }
  }

  private async assertShopCategory(categoryId: string): Promise<void> {
    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
      select: { scope: true },
    });
    if (!category || category.scope !== ProductScope.SHOP) {
      throw new BadRequestException({
        statusCode: 400,
        code: 'CATEGORY_SCOPE_MISMATCH',
        message: 'An e-shop product category must belong to the SHOP scope',
      });
    }
  }

  private rethrowDuplicate(error: unknown): void {
    const target = uniqueTargetText(error);
    if (target === null) {
      return;
    }
    if (target.includes('sku')) {
      throw new ConflictException({
        statusCode: 409,
        code: 'SKU_TAKEN',
        message: 'An e-shop product with this SKU already exists',
      });
    }
    throw new ConflictException({
      statusCode: 409,
      code: 'SLUG_TAKEN',
      message: 'An e-shop product with this slug already exists',
    });
  }
}
