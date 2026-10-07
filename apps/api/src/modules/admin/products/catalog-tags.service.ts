import { BadRequestException, Injectable } from '@nestjs/common';
import type { CatalogTag } from '@smshop/db';
import { PrismaService } from '../../prisma/prisma.service.js';

export type CatalogTagSummary = Pick<CatalogTag, 'id' | 'name' | 'slug'>;

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 'P2002'
  );
}

const LITHUANIAN_DIACRITICS: Record<string, string> = {
  ą: 'a',
  č: 'c',
  ę: 'e',
  ė: 'e',
  į: 'i',
  š: 's',
  ų: 'u',
  ū: 'u',
  ž: 'z',
};

/**
 * Derives a stable kebab-case slug from a human tag name. Lithuanian
 * diacritics are transliterated so employees never need to type technical
 * slugs (`Vyšnios` -> `vysnios`, `Šokoladas` -> `sokoladas`).
 */
export function normalizeTagSlug(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[ąčęėįšųūž]/g, (char) => LITHUANIAN_DIACRITICS[char] ?? char)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 140);
}

/**
 * Reusable catalogue tags (catalogue scope only; never e-shop tags). Creation
 * is idempotent by normalized slug: reusing an existing tag returns it instead
 * of failing, so the admin UI can offer "type a name" without duplicate-risk.
 */
@Injectable()
export class CatalogTagsService {
  constructor(private readonly prisma: PrismaService) {}

  list(): Promise<CatalogTagSummary[]> {
    return this.prisma.catalogTag.findMany({
      orderBy: [{ name: 'asc' }],
      select: { id: true, name: true, slug: true },
    });
  }

  async ensure(name: string): Promise<CatalogTagSummary> {
    const trimmed = name.trim();
    const slug = normalizeTagSlug(trimmed);
    if (!slug) {
      throw new BadRequestException({
        statusCode: 400,
        code: 'INVALID_TAG_NAME',
        message: 'Tag name must contain at least one letter or digit',
      });
    }

    const existing = await this.prisma.catalogTag.findUnique({
      where: { slug },
      select: { id: true, name: true, slug: true },
    });
    if (existing) {
      return existing;
    }

    try {
      return await this.prisma.catalogTag.create({
        data: { name: trimmed, slug },
        select: { id: true, name: true, slug: true },
      });
    } catch (error) {
      // Lost a race with a concurrent create of the same slug: reuse it.
      if (isUniqueViolation(error)) {
        const raced = await this.prisma.catalogTag.findUnique({
          where: { slug },
          select: { id: true, name: true, slug: true },
        });
        if (raced) {
          return raced;
        }
      }
      throw error;
    }
  }

  /** Validates that every referenced tag exists before connecting it. */
  async assertExist(ids: string[]): Promise<void> {
    if (ids.length === 0) {
      return;
    }
    const unique = [...new Set(ids)];
    const found = await this.prisma.catalogTag.count({ where: { id: { in: unique } } });
    if (found !== unique.length) {
      throw new BadRequestException({
        statusCode: 400,
        code: 'INVALID_TAG',
        message: 'One or more selected tags do not exist',
      });
    }
  }
}
