import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ProductScope, type CatalogProduct } from '@smshop/db';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CatalogTagsService } from './catalog-tags.service.js';
import type {
  CreateCatalogProductDto,
  UpdateCatalogProductDto,
} from './dto/catalog-product.dto.js';

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 'P2002'
  );
}

const CATEGORY_SELECT = { select: { id: true, name: true, slug: true } } as const;
const TAG_SELECT = { select: { id: true, name: true, slug: true } } as const;
const PRODUCT_INCLUDE = {
  category: CATEGORY_SELECT,
  tags: { ...TAG_SELECT, orderBy: { name: 'asc' } },
} as const;

export type CatalogProductWithCategory = CatalogProduct & {
  category: { id: string; name: string; slug: string };
  tags: { id: string; name: string; slug: string }[];
};

export interface PaginatedCatalogProducts {
  items: CatalogProductWithCategory[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

/**
 * Catalogue (informational) product management. Products here have no
 * commercial fields; the category must belong to the CATALOG scope.
 */
@Injectable()
export class CatalogProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tags: CatalogTagsService,
  ) {}

  async list(page: number, pageSize: number): Promise<PaginatedCatalogProducts> {
    const take = pageSize;
    const [total, items] = await this.prisma.$transaction([
      this.prisma.catalogProduct.count(),
      this.prisma.catalogProduct.findMany({
        orderBy: [{ displayOrder: 'asc' }, { createdAt: 'desc' }],
        skip: (page - 1) * take,
        take,
        include: PRODUCT_INCLUDE,
      }),
    ]);
    return { items, page, pageSize: take, total, totalPages: Math.ceil(total / take) };
  }

  async create(dto: CreateCatalogProductDto): Promise<CatalogProductWithCategory> {
    await this.assertCatalogCategory(dto.categoryId);
    const tagIds = [...new Set(dto.tagIds ?? [])];
    await this.tags.assertExist(tagIds);
    try {
      return await this.prisma.catalogProduct.create({
        data: {
          categoryId: dto.categoryId,
          name: dto.name,
          slug: dto.slug,
          description: dto.description,
          primaryImageUrl: dto.primaryImageUrl,
          galleryImageUrls: dto.galleryImageUrls ?? [],
          status: dto.status,
          featured: dto.featured,
          displayOrder: dto.displayOrder,
          tags: { connect: tagIds.map((id) => ({ id })) },
        },
        include: PRODUCT_INCLUDE,
      });
    } catch (error) {
      this.rethrowDuplicate(error);
      throw error;
    }
  }

  async update(id: string, dto: UpdateCatalogProductDto): Promise<CatalogProductWithCategory> {
    const existing = await this.prisma.catalogProduct.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Product not found');
    }
    if (dto.categoryId !== undefined) {
      await this.assertCatalogCategory(dto.categoryId);
    }
    const tagIds = dto.tagIds === undefined ? undefined : [...new Set(dto.tagIds)];
    if (tagIds !== undefined) {
      await this.tags.assertExist(tagIds);
    }
    try {
      return await this.prisma.catalogProduct.update({
        where: { id },
        data: {
          ...(dto.categoryId !== undefined ? { categoryId: dto.categoryId } : {}),
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.slug !== undefined ? { slug: dto.slug } : {}),
          ...(dto.description !== undefined ? { description: dto.description } : {}),
          ...(dto.primaryImageUrl !== undefined ? { primaryImageUrl: dto.primaryImageUrl } : {}),
          ...(dto.galleryImageUrls !== undefined ? { galleryImageUrls: dto.galleryImageUrls } : {}),
          ...(dto.status !== undefined ? { status: dto.status } : {}),
          ...(dto.featured !== undefined ? { featured: dto.featured } : {}),
          ...(dto.displayOrder !== undefined ? { displayOrder: dto.displayOrder } : {}),
          ...(tagIds !== undefined
            ? { tags: { set: tagIds.map((tagId) => ({ id: tagId })) } }
            : {}),
        },
        include: PRODUCT_INCLUDE,
      });
    } catch (error) {
      this.rethrowDuplicate(error);
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    const existing = await this.prisma.catalogProduct.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Product not found');
    }
    await this.prisma.catalogProduct.delete({ where: { id } });
  }

  private async assertCatalogCategory(categoryId: string): Promise<void> {
    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
      select: { scope: true },
    });
    if (!category || category.scope !== ProductScope.CATALOG) {
      throw new BadRequestException({
        statusCode: 400,
        code: 'CATEGORY_SCOPE_MISMATCH',
        message: 'A catalogue product category must belong to the CATALOG scope',
      });
    }
  }

  private rethrowDuplicate(error: unknown): void {
    if (isUniqueViolation(error)) {
      throw new ConflictException({
        statusCode: 409,
        code: 'SLUG_TAKEN',
        message: 'A catalogue product with this slug already exists',
      });
    }
  }
}
