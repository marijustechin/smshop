import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaClient, ProductScope } from '@smshop/db';
import { PrismaService } from '../../src/modules/prisma/prisma.service.js';
import { createTestPrismaClient, truncateAll } from './helpers.js';
import { createAuthTestApp } from './auth-app.js';

const PRODUCT_KEYS = [
  'description',
  'displayOrder',
  'featured',
  'name',
  'primaryImageUrl',
  'rating',
  'slug',
  'tags',
];

describe('Public catalogue visibility (real PostgreSQL)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  const sendMail = vi.fn();

  beforeAll(async () => {
    prisma = createTestPrismaClient();
    ({ app } = await createAuthTestApp(prisma as unknown as PrismaService, sendMail));
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    sendMail.mockReset();
    sendMail.mockResolvedValue(undefined);
    await truncateAll(prisma);
  });

  async function createCategory(scope: ProductScope, slug: string, isActive = true) {
    return prisma.category.create({
      data: { scope, slug, name: slug, isActive },
    });
  }

  async function createCatalogProduct(options: {
    categoryId: string;
    slug: string;
    status?: 'DRAFT' | 'PUBLISHED' | 'HIDDEN';
    featured?: boolean;
    displayOrder?: number;
  }) {
    return prisma.catalogProduct.create({
      data: {
        categoryId: options.categoryId,
        name: options.slug,
        slug: options.slug,
        description: `${options.slug} full`,
        primaryImageUrl: `https://example.com/${options.slug}.jpg`,
        status: options.status ?? 'PUBLISHED',
        featured: options.featured ?? false,
        displayOrder: options.displayOrder ?? 0,
      },
    });
  }

  async function seed() {
    const tortai = await createCategory(ProductScope.CATALOG, 'tortai');
    await createCatalogProduct({ categoryId: tortai.id, slug: 'cake-a', displayOrder: 1 });
    await createCatalogProduct({ categoryId: tortai.id, slug: 'cake-b', displayOrder: 2 });
    await createCatalogProduct({
      categoryId: tortai.id,
      slug: 'featured-cake',
      featured: true,
      displayOrder: 5,
    });
    await createCatalogProduct({ categoryId: tortai.id, slug: 'draft-cake', status: 'DRAFT' });
    await createCatalogProduct({ categoryId: tortai.id, slug: 'hidden-cake', status: 'HIDDEN' });

    const inactive = await createCategory(ProductScope.CATALOG, 'sena', false);
    await createCatalogProduct({ categoryId: inactive.id, slug: 'old-cake' });

    const shop = await createCategory(ProductScope.SHOP, 'plyteles');
    await prisma.shopProduct.create({
      data: {
        categoryId: shop.id,
        name: 'Plytelė',
        slug: 'bar',
        shortDescription: 'short',
        description: 'full',
        primaryImageUrl: 'https://example.com/bar.jpg',
        priceCents: 999,
        status: 'PUBLISHED',
        stockQuantity: 5,
      },
    });
    return { tortai };
  }

  it('lists only published products of the active catalogue category, featured first', async () => {
    await seed();
    const res = await request(app.getHttpServer()).get('/api/public/catalog/categories/tortai');

    expect(res.status).toBe(200);
    expect(res.body.category).toEqual({ name: 'tortai', slug: 'tortai' });
    expect(res.body.products.map((product: { slug: string }) => product.slug)).toEqual([
      'featured-cake',
      'cake-a',
      'cake-b',
    ]);
    for (const product of res.body.products) {
      expect(Object.keys(product).sort()).toEqual(PRODUCT_KEYS);
    }
    expect(JSON.stringify(res.body)).not.toContain('priceCents');
    expect(JSON.stringify(res.body)).not.toContain('stockQuantity');
    expect(JSON.stringify(res.body)).not.toContain('status');
  });

  it('returns a published catalogue product with only public fields', async () => {
    await seed();
    const res = await request(app.getHttpServer()).get('/api/public/catalog/products/cake-a');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      slug: 'cake-a',
      name: 'cake-a',
      category: { name: 'tortai', slug: 'tortai' },
    });
    expect(Object.keys(res.body).sort()).toEqual([...PRODUCT_KEYS, 'category'].sort());
  });

  it('hides draft and hidden products behind 404', async () => {
    await seed();
    expect(
      (await request(app.getHttpServer()).get('/api/public/catalog/products/draft-cake')).status,
    ).toBe(404);
    expect(
      (await request(app.getHttpServer()).get('/api/public/catalog/products/hidden-cake')).status,
    ).toBe(404);
  });

  it('never exposes an inactive category or its products', async () => {
    await seed();
    expect(
      (await request(app.getHttpServer()).get('/api/public/catalog/categories/sena')).status,
    ).toBe(404);
    expect(
      (await request(app.getHttpServer()).get('/api/public/catalog/products/old-cake')).status,
    ).toBe(404);
  });

  it('never exposes SHOP scope categories or products', async () => {
    await seed();
    expect(
      (await request(app.getHttpServer()).get('/api/public/catalog/categories/plyteles')).status,
    ).toBe(404);
    expect(
      (await request(app.getHttpServer()).get('/api/public/catalog/products/bar')).status,
    ).toBe(404);
  });

  it('returns 404 for unknown categories and products', async () => {
    await seed();
    expect(
      (await request(app.getHttpServer()).get('/api/public/catalog/categories/nezinoma')).status,
    ).toBe(404);
    expect(
      (await request(app.getHttpServer()).get('/api/public/catalog/products/nezinomas')).status,
    ).toBe(404);
  });

  it('returns catalogue tags as public name/slug pairs without internal ids', async () => {
    await seed();
    const chocolate = await prisma.catalogTag.create({
      data: { name: 'Šokoladas', slug: 'sokoladas' },
    });
    const cherries = await prisma.catalogTag.create({
      data: { name: 'Vyšnios', slug: 'vysnios' },
    });
    await prisma.catalogProduct.update({
      where: { slug: 'cake-a' },
      data: { tags: { connect: [{ id: chocolate.id }, { id: cherries.id }] } },
    });

    const res = await request(app.getHttpServer()).get('/api/public/catalog/categories/tortai');
    const cake = res.body.products.find((product: { slug: string }) => product.slug === 'cake-a');
    expect(cake.tags).toEqual(
      expect.arrayContaining([
        { name: 'Šokoladas', slug: 'sokoladas' },
        { name: 'Vyšnios', slug: 'vysnios' },
      ]),
    );
    expect(JSON.stringify(res.body)).not.toContain(chocolate.id);
    // Product without tags returns an empty list, never undefined.
    const other = res.body.products.find((product: { slug: string }) => product.slug === 'cake-b');
    expect(other.tags).toEqual([]);
  });

  it('exposes an imported rating only when a positive score and count both exist', async () => {
    await seed();
    await prisma.catalogProduct.update({
      where: { slug: 'cake-a' },
      data: {
        ratingAverage: '4.9',
        ratingCount: 61,
        ratingSourceUrl: 'https://www.sokoladomeistrai.lt/tortas-traskioji-vysnaite/',
        ratingImportedAt: new Date('2026-09-24T00:00:00.000Z'),
      },
    });
    // Incomplete imported data: a zero count must never render as a rating.
    await prisma.catalogProduct.update({
      where: { slug: 'cake-b' },
      data: { ratingAverage: '4.2', ratingCount: 0 },
    });

    const res = await request(app.getHttpServer()).get('/api/public/catalog/categories/tortai');
    const bySlug = (slug: string) =>
      res.body.products.find((product: { slug: string }) => product.slug === slug);

    expect(bySlug('cake-a').rating).toEqual({ average: 4.9, count: 61 });
    expect(bySlug('cake-b').rating).toBeNull();
    expect(bySlug('featured-cake').rating).toBeNull();

    // The imported provenance is stored exactly (and never guessed).
    await expect(
      prisma.catalogProduct.findUnique({
        where: { slug: 'cake-a' },
        select: { ratingSourceUrl: true, ratingImportedAt: true },
      }),
    ).resolves.toEqual({
      ratingSourceUrl: 'https://www.sokoladomeistrai.lt/tortas-traskioji-vysnaite/',
      ratingImportedAt: new Date('2026-09-24T00:00:00.000Z'),
    });

    // Provenance and raw decimal fields stay internal.
    expect(JSON.stringify(res.body)).not.toContain('sokoladomeistrai');
    expect(JSON.stringify(res.body)).not.toContain('ratingSourceUrl');
    expect(JSON.stringify(res.body)).not.toContain('ratingAverage');
    expect(JSON.stringify(res.body)).not.toContain('ratingImportedAt');
  });

  it('returns the imported rating and tags on the product detail endpoint', async () => {
    await seed();
    const tag = await prisma.catalogTag.create({ data: { name: 'Vyšnios', slug: 'vysnios' } });
    await prisma.catalogProduct.update({
      where: { slug: 'cake-a' },
      data: {
        tags: { connect: [{ id: tag.id }] },
        ratingAverage: '4.3',
        ratingCount: 23,
        ratingSourceUrl: 'https://www.sokoladomeistrai.lt/karaliskasis-tortas/',
        ratingImportedAt: new Date('2026-09-24T00:00:00.000Z'),
      },
    });

    const res = await request(app.getHttpServer()).get('/api/public/catalog/products/cake-a');
    expect(res.status).toBe(200);
    expect(res.body.tags).toEqual([{ name: 'Vyšnios', slug: 'vysnios' }]);
    expect(res.body.rating).toEqual({ average: 4.3, count: 23 });
    expect(Object.keys(res.body).sort()).toEqual([...PRODUCT_KEYS, 'category'].sort());
  });
});
