import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ProductScope, type Category } from '@smshop/db';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto.js';

const MAX_DEPTH = 50;

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 'P2002'
  );
}

/**
 * Category management for one product scope. A category always belongs to
 * exactly one scope; parents, slugs and product references are validated within
 * that scope so catalogue and e-shop categories can never be mixed.
 */
@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  list(scope: ProductScope): Promise<Category[]> {
    return this.prisma.category.findMany({
      where: { scope },
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async create(scope: ProductScope, dto: CreateCategoryDto): Promise<Category> {
    if (dto.parentId) {
      await this.assertParent(scope, dto.parentId);
    }
    try {
      return await this.prisma.category.create({
        data: {
          scope,
          name: dto.name,
          slug: dto.slug,
          parentId: dto.parentId ?? null,
          displayOrder: dto.displayOrder,
          isActive: dto.isActive,
        },
      });
    } catch (error) {
      this.rethrowDuplicate(error);
      throw error;
    }
  }

  async update(scope: ProductScope, id: string, dto: UpdateCategoryDto): Promise<Category> {
    const existing = await this.prisma.category.findFirst({ where: { id, scope } });
    if (!existing) {
      throw new NotFoundException('Category not found');
    }

    if (dto.parentId !== undefined && dto.parentId !== null) {
      if (dto.parentId === id) {
        throw new BadRequestException({
          statusCode: 400,
          code: 'CATEGORY_PARENT_SELF',
          message: 'A category cannot be its own parent',
        });
      }
      await this.assertParent(scope, dto.parentId);
      await this.assertNoCycle(id, dto.parentId);
    }

    try {
      return await this.prisma.category.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.slug !== undefined ? { slug: dto.slug } : {}),
          ...(dto.parentId !== undefined ? { parentId: dto.parentId } : {}),
          ...(dto.displayOrder !== undefined ? { displayOrder: dto.displayOrder } : {}),
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        },
      });
    } catch (error) {
      this.rethrowDuplicate(error);
      throw error;
    }
  }

  /**
   * Deletes a category only when it is safe: products are never silently
   * orphaned and subcategories are never silently detached. Both cases return a
   * conflict; the DB `ON DELETE RESTRICT` foreign keys are the last-resort guard.
   */
  async delete(scope: ProductScope, id: string): Promise<void> {
    const existing = await this.prisma.category.findFirst({ where: { id, scope } });
    if (!existing) {
      throw new NotFoundException('Category not found');
    }

    const [catalogProducts, shopProducts, children] = await this.prisma.$transaction([
      this.prisma.catalogProduct.count({ where: { categoryId: id } }),
      this.prisma.shopProduct.count({ where: { categoryId: id } }),
      this.prisma.category.count({ where: { parentId: id } }),
    ]);

    if (catalogProducts + shopProducts > 0) {
      throw new ConflictException({
        statusCode: 409,
        code: 'CATEGORY_IN_USE',
        message: 'Category has products; remove or reassign them before deleting it',
      });
    }
    if (children > 0) {
      throw new ConflictException({
        statusCode: 409,
        code: 'CATEGORY_HAS_CHILDREN',
        message: 'Category has subcategories; remove them before deleting it',
      });
    }

    await this.prisma.category.delete({ where: { id } });
  }

  private async assertParent(scope: ProductScope, parentId: string): Promise<void> {
    const parent = await this.prisma.category.findUnique({ where: { id: parentId } });
    if (!parent || parent.scope !== scope) {
      throw new BadRequestException({
        statusCode: 400,
        code: 'INVALID_PARENT',
        message: 'Parent category must exist in the same scope',
      });
    }
  }

  private async assertNoCycle(id: string, parentId: string): Promise<void> {
    let current: string | null = parentId;
    for (let depth = 0; depth < MAX_DEPTH && current; depth += 1) {
      if (current === id) {
        throw new BadRequestException({
          statusCode: 400,
          code: 'CATEGORY_CYCLE',
          message: 'Category hierarchy cannot contain a cycle',
        });
      }
      const node: { parentId: string | null } | null = await this.prisma.category.findUnique({
        where: { id: current },
        select: { parentId: true },
      });
      current = node?.parentId ?? null;
    }
  }

  private rethrowDuplicate(error: unknown): void {
    if (isUniqueViolation(error)) {
      throw new ConflictException({
        statusCode: 409,
        code: 'SLUG_TAKEN',
        message: 'A category with this slug already exists in this scope',
      });
    }
  }
}
