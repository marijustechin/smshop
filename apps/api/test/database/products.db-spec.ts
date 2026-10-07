import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaClient, ProductScope, Role as PrismaRole } from '@smshop/db';
import { PrismaService } from '../../src/modules/prisma/prisma.service.js';
import { AuthSessionService } from '../../src/modules/auth/session/auth-session.service.js';
import { publicShopProductWhere } from '../../src/modules/admin/products/shop-product.policy.js';
import { createTestPrismaClient, truncateAll } from './helpers.js';
import { createAuthTestApp } from './auth-app.js';

describe('Admin catalogue and e-shop management (real PostgreSQL)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let sessions: AuthSessionService;
  const sendMail = vi.fn();

  beforeAll(async () => {
    prisma = createTestPrismaClient();
    ({ app } = await createAuthTestApp(prisma as unknown as PrismaService, sendMail));
    sessions = app.get(AuthSessionService);
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

  async function createUser(role: PrismaRole) {
    const email = `${role.toLowerCase()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
    return prisma.user.create({
      data: { email, emailNormalized: email, role, emailVerifiedAt: new Date() },
    });
  }

  async function tokenForRole(role: PrismaRole): Promise<string> {
    const user = await createUser(role);
    const { accessToken } = await sessions.createSession(user.id);
    return accessToken;
  }

  function api(method: 'get' | 'post' | 'patch' | 'delete', path: string, token?: string) {
    const req = request(app.getHttpServer())[method](path);
    return token ? req.set('Authorization', `Bearer ${token}`) : req;
  }

  async function catalogCategory(slug: string, name = `Cat ${slug}`) {
    return prisma.category.create({ data: { scope: ProductScope.CATALOG, name, slug } });
  }
  async function shopCategory(slug: string, name = `Shop ${slug}`) {
    return prisma.category.create({ data: { scope: ProductScope.SHOP, name, slug } });
  }

  const catalogProductBody = (categoryId: string, slug: string) => ({
    categoryId,
    name: 'Šventinis tortas',
    slug,
    description: 'Ilgas aprašymas',
    primaryImageUrl: 'https://example.com/cake.jpg',
  });

  const shopProductBody = (categoryId: string, slug: string) => ({
    categoryId,
    name: 'Šokolado plytelė',
    slug,
    shortDescription: 'Trumpas aprašymas',
    description: 'Ilgas aprašymas',
    primaryImageUrl: 'https://example.com/bar.jpg',
    priceCents: 1000,
  });

  describe('authorization boundaries', () => {
    it('rejects unauthenticated, user and editor; allows admin', async () => {
      expect((await api('get', '/api/admin/catalog/categories')).status).toBe(401);

      const userToken = await tokenForRole(PrismaRole.USER);
      const editorToken = await tokenForRole(PrismaRole.EDITOR);
      expect((await api('get', '/api/admin/catalog/categories', userToken)).status).toBe(403);
      expect((await api('get', '/api/admin/shop/products', editorToken)).status).toBe(403);

      const adminToken = await tokenForRole(PrismaRole.ADMIN);
      const res = await api('get', '/api/admin/catalog/categories', adminToken);
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });
  });

  describe('category scope and slug rules', () => {
    it('keeps the same slug valid across scopes but unique within a scope', async () => {
      const admin = await tokenForRole(PrismaRole.ADMIN);
      const catalog = await api('post', '/api/admin/catalog/categories', admin).send({
        name: 'Tortai',
        slug: 'tortai',
      });
      expect(catalog.status).toBe(201);
      expect(catalog.body.scope).toBe('CATALOG');

      const shop = await api('post', '/api/admin/shop/categories', admin).send({
        name: 'Tortai',
        slug: 'tortai',
      });
      expect(shop.status).toBe(201);
      expect(shop.body.scope).toBe('SHOP');

      const duplicate = await api('post', '/api/admin/catalog/categories', admin).send({
        name: 'Kitas',
        slug: 'tortai',
      });
      expect(duplicate.status).toBe(409);
      expect(duplicate.body.code).toBe('SLUG_TAKEN');
    });

    it('rejects a parent from the other scope', async () => {
      const admin = await tokenForRole(PrismaRole.ADMIN);
      const shop = await shopCategory('shop-parent');

      const res = await api('post', '/api/admin/catalog/categories', admin).send({
        name: 'Šventiniai tortai',
        slug: 'sventiniai-tortai',
        parentId: shop.id,
      });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_PARENT');
    });

    it('treats an explicit null parent as a root category but rejects an empty string', async () => {
      const admin = await tokenForRole(PrismaRole.ADMIN);

      const root = await api('post', '/api/admin/catalog/categories', admin).send({
        name: 'Tortai',
        slug: 'tortai',
        parentId: null,
      });
      expect(root.status).toBe(201);
      expect(root.body.parentId).toBeNull();

      const empty = await api('post', '/api/admin/catalog/categories', admin).send({
        name: 'Bloga',
        slug: 'bloga',
        parentId: '',
      });
      expect(empty.status).toBe(400);
    });
  });

  describe('cross-scope category assignment', () => {
    it('rejects a shop category on a catalogue product and vice versa', async () => {
      const admin = await tokenForRole(PrismaRole.ADMIN);
      const catalog = await catalogCategory('catalog-a');
      const shop = await shopCategory('shop-a');

      const catalogWithShop = await api('post', '/api/admin/catalog/products', admin).send(
        catalogProductBody(shop.id, 'product-1'),
      );
      expect(catalogWithShop.status).toBe(400);
      expect(catalogWithShop.body.code).toBe('CATEGORY_SCOPE_MISMATCH');

      const shopWithCatalog = await api('post', '/api/admin/shop/products', admin).send(
        shopProductBody(catalog.id, 'product-2'),
      );
      expect(shopWithCatalog.status).toBe(400);
      expect(shopWithCatalog.body.code).toBe('CATEGORY_SCOPE_MISMATCH');
    });
  });

  describe('category deletion protection', () => {
    it('refuses to delete a category that still has products', async () => {
      const admin = await tokenForRole(PrismaRole.ADMIN);
      const category = await catalogCategory('with-product');
      await api('post', '/api/admin/catalog/products', admin).send(
        catalogProductBody(category.id, 'cake-1'),
      );

      const res = await api('delete', `/api/admin/catalog/categories/${category.id}`, admin);
      expect(res.status).toBe(409);
      expect(res.body.code).toBe('CATEGORY_IN_USE');
      await expect(
        prisma.catalogProduct.count({ where: { categoryId: category.id } }),
      ).resolves.toBe(1);
    });

    it('refuses to delete a category that still has subcategories', async () => {
      const admin = await tokenForRole(PrismaRole.ADMIN);
      const parent = await catalogCategory('parent');
      await prisma.category.create({
        data: { scope: ProductScope.CATALOG, name: 'Child', slug: 'child', parentId: parent.id },
      });

      const res = await api('delete', `/api/admin/catalog/categories/${parent.id}`, admin);
      expect(res.status).toBe(409);
      expect(res.body.code).toBe('CATEGORY_HAS_CHILDREN');
    });

    it('deletes an empty category', async () => {
      const admin = await tokenForRole(PrismaRole.ADMIN);
      const category = await catalogCategory('empty');

      const res = await api('delete', `/api/admin/catalog/categories/${category.id}`, admin);
      expect(res.status).toBe(204);
      await expect(prisma.category.findUnique({ where: { id: category.id } })).resolves.toBeNull();
    });
  });

  describe('catalogue product shape', () => {
    it('creates a catalogue product without any commercial fields', async () => {
      const admin = await tokenForRole(PrismaRole.ADMIN);
      const category = await catalogCategory('tortai');

      const res = await api('post', '/api/admin/catalog/products', admin).send(
        catalogProductBody(category.id, 'sventinis-tortas'),
      );
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        slug: 'sventinis-tortas',
        status: 'DRAFT',
        featured: false,
        category: { id: category.id, slug: 'tortai' },
      });
      const keys = Object.keys(res.body).sort();
      expect(keys).not.toContain('priceCents');
      expect(keys).not.toContain('stockQuantity');
      expect(keys).not.toContain('sku');
      expect(keys).not.toContain('salePriceCents');
    });

    it('rejects a commercial field on a catalogue product (strict DTO)', async () => {
      const admin = await tokenForRole(PrismaRole.ADMIN);
      const category = await catalogCategory('tortai');

      const res = await api('post', '/api/admin/catalog/products', admin).send({
        ...catalogProductBody(category.id, 'bad-cake'),
        priceCents: 999,
      });
      expect(res.status).toBe(400);
    });
  });

  describe('shop product pricing and stock validation', () => {
    it('creates a valid shop product and lists it with integer cents and stock', async () => {
      const admin = await tokenForRole(PrismaRole.ADMIN);
      const category = await shopCategory('plyteles');

      const created = await api('post', '/api/admin/shop/products', admin).send({
        ...shopProductBody(category.id, 'tamsus-sokoladas'),
        salePriceCents: 800,
        stockQuantity: 5,
        status: 'PUBLISHED',
      });
      expect(created.status).toBe(201);
      expect(created.body).toMatchObject({
        priceCents: 1000,
        salePriceCents: 800,
        stockQuantity: 5,
      });

      const list = await api('get', '/api/admin/shop/products', admin);
      expect(list.status).toBe(200);
      expect(list.body.items).toHaveLength(1);
      expect(list.body.items[0]).toMatchObject({ stockQuantity: 5, priceCents: 1000 });
    });

    it('rejects a sale price that is not lower than the base price', async () => {
      const admin = await tokenForRole(PrismaRole.ADMIN);
      const category = await shopCategory('plyteles');
      const res = await api('post', '/api/admin/shop/products', admin).send({
        ...shopProductBody(category.id, 'sale-bad'),
        salePriceCents: 1000,
      });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('SALE_PRICE_NOT_LOWER');
    });

    it('rejects a sale end that precedes the sale start', async () => {
      const admin = await tokenForRole(PrismaRole.ADMIN);
      const category = await shopCategory('plyteles');
      const res = await api('post', '/api/admin/shop/products', admin).send({
        ...shopProductBody(category.id, 'dates-bad'),
        saleStartsAt: '2026-03-01T00:00:00.000Z',
        saleEndsAt: '2026-02-01T00:00:00.000Z',
      });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('SALE_END_BEFORE_START');
    });

    it('rejects negative stock, fractional prices and duplicate sku/slug', async () => {
      const admin = await tokenForRole(PrismaRole.ADMIN);
      const category = await shopCategory('plyteles');

      expect(
        (
          await api('post', '/api/admin/shop/products', admin).send({
            ...shopProductBody(category.id, 'neg'),
            stockQuantity: -1,
          })
        ).status,
      ).toBe(400);

      expect(
        (
          await api('post', '/api/admin/shop/products', admin).send({
            ...shopProductBody(category.id, 'frac'),
            priceCents: 10.5,
          })
        ).status,
      ).toBe(400);

      const first = await api('post', '/api/admin/shop/products', admin).send({
        ...shopProductBody(category.id, 'dup-slug'),
        sku: 'SKU-1',
      });
      expect(first.status).toBe(201);

      const dupSku = await api('post', '/api/admin/shop/products', admin).send({
        ...shopProductBody(category.id, 'other-slug'),
        sku: 'SKU-1',
      });
      expect(dupSku.status).toBe(409);
      expect(dupSku.body.code).toBe('SKU_TAKEN');

      const dupSlug = await api('post', '/api/admin/shop/products', admin).send({
        ...shopProductBody(category.id, 'dup-slug'),
        sku: 'SKU-2',
      });
      expect(dupSlug.status).toBe(409);
      expect(dupSlug.body.code).toBe('SLUG_TAKEN');
    });

    it('deletes a shop product', async () => {
      const admin = await tokenForRole(PrismaRole.ADMIN);
      const category = await shopCategory('plyteles');
      const created = await api('post', '/api/admin/shop/products', admin).send(
        shopProductBody(category.id, 'to-delete'),
      );

      const res = await api('delete', `/api/admin/shop/products/${created.body.id}`, admin);
      expect(res.status).toBe(204);
      await expect(
        prisma.shopProduct.findUnique({ where: { id: created.body.id } }),
      ).resolves.toBeNull();
    });
  });

  describe('public e-shop eligibility rule', () => {
    it('excludes drafts, hidden and zero-stock products', async () => {
      const category = await shopCategory('plyteles');
      const base = shopProductBody(category.id, 'x');
      await prisma.shopProduct.create({
        data: { ...base, slug: 'published-in-stock', status: 'PUBLISHED', stockQuantity: 5 },
      });
      await prisma.shopProduct.create({
        data: { ...base, slug: 'published-out-of-stock', status: 'PUBLISHED', stockQuantity: 0 },
      });
      await prisma.shopProduct.create({
        data: { ...base, slug: 'draft-in-stock', status: 'DRAFT', stockQuantity: 5 },
      });
      await prisma.shopProduct.create({
        data: { ...base, slug: 'hidden-in-stock', status: 'HIDDEN', stockQuantity: 5 },
      });

      const visible = await prisma.shopProduct.findMany({
        where: publicShopProductWhere(),
        select: { slug: true },
      });
      expect(visible.map((product) => product.slug)).toEqual(['published-in-stock']);
    });
  });

  describe('catalogue tags', () => {
    it('creates a tag from a human name with a normalized unique slug', async () => {
      const admin = await tokenForRole(PrismaRole.ADMIN);
      const created = await api('post', '/api/admin/catalog/tags', admin).send({
        name: 'Šokoladas',
      });
      expect(created.status).toBe(200);
      expect(created.body).toMatchObject({ name: 'Šokoladas', slug: 'sokoladas' });

      // Same normalized slug reuses the existing tag: no duplicate row.
      const again = await api('post', '/api/admin/catalog/tags', admin).send({ name: 'sokoladas' });
      expect(again.status).toBe(200);
      expect(again.body.id).toBe(created.body.id);
      await expect(prisma.catalogTag.count()).resolves.toBe(1);
    });

    it('rejects a tag name with no usable characters', async () => {
      const admin = await tokenForRole(PrismaRole.ADMIN);
      const res = await api('post', '/api/admin/catalog/tags', admin).send({ name: '###' });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_TAG_NAME');
    });

    it('attaches tags to a catalogue product and never duplicates an assignment', async () => {
      const admin = await tokenForRole(PrismaRole.ADMIN);
      const category = await catalogCategory('tortai');
      const tag = await api('post', '/api/admin/catalog/tags', admin).send({ name: 'Vyšnios' });

      const created = await api('post', '/api/admin/catalog/products', admin).send({
        ...catalogProductBody(category.id, 'cake-tags'),
        tagIds: [tag.body.id],
      });
      expect(created.status).toBe(201);
      expect(created.body.tags).toEqual([{ id: tag.body.id, name: 'Vyšnios', slug: 'vysnios' }]);

      // Duplicate ids in one request cannot create a duplicate assignment.
      const updated = await api(
        'patch',
        `/api/admin/catalog/products/${created.body.id}`,
        admin,
      ).send({ tagIds: [tag.body.id, tag.body.id] });
      expect(updated.status).toBe(200);
      expect(updated.body.tags).toHaveLength(1);

      const stored = await prisma.catalogTag.findUnique({
        where: { id: tag.body.id },
        include: { products: true },
      });
      expect(stored?.products.map((product) => product.id)).toEqual([created.body.id]);
    });

    it('lets one tag belong to many catalogue products', async () => {
      const admin = await tokenForRole(PrismaRole.ADMIN);
      const category = await catalogCategory('tortai');
      const tag = await api('post', '/api/admin/catalog/tags', admin).send({ name: 'Šokoladas' });

      for (const slug of ['cake-one', 'cake-two']) {
        const created = await api('post', '/api/admin/catalog/products', admin).send({
          ...catalogProductBody(category.id, slug),
          tagIds: [tag.body.id],
        });
        expect(created.status).toBe(201);
      }
      await expect(
        prisma.catalogProduct.count({ where: { tags: { some: { id: tag.body.id } } } }),
      ).resolves.toBe(2);
    });

    it('rejects an unknown tag id', async () => {
      const admin = await tokenForRole(PrismaRole.ADMIN);
      const category = await catalogCategory('tortai');
      const res = await api('post', '/api/admin/catalog/products', admin).send({
        ...catalogProductBody(category.id, 'cake-bad-tag'),
        tagIds: ['00000000-0000-4000-8000-000000000000'],
      });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_TAG');
    });

    it('keeps tag reads and writes admin-only', async () => {
      expect((await api('get', '/api/admin/catalog/tags')).status).toBe(401);

      const editorToken = await tokenForRole(PrismaRole.EDITOR);
      expect((await api('get', '/api/admin/catalog/tags', editorToken)).status).toBe(403);
      expect(
        (await api('post', '/api/admin/catalog/tags', editorToken).send({ name: 'X' })).status,
      ).toBe(403);

      const admin = await tokenForRole(PrismaRole.ADMIN);
      expect((await api('get', '/api/admin/catalog/tags', admin)).status).toBe(200);
    });

    it('does not accept imported rating fields as employee input (strict DTO)', async () => {
      const admin = await tokenForRole(PrismaRole.ADMIN);
      const category = await catalogCategory('tortai');
      const res = await api('post', '/api/admin/catalog/products', admin).send({
        ...catalogProductBody(category.id, 'cake-rating-input'),
        ratingAverage: 5,
        ratingCount: 99,
      });
      expect(res.status).toBe(400);
    });
  });

  describe('catalogue description length rule', () => {
    it('accepts exactly 1000 characters and rejects 1001 on create and update', async () => {
      const admin = await tokenForRole(PrismaRole.ADMIN);
      const category = await catalogCategory('tortai');

      const ok = await api('post', '/api/admin/catalog/products', admin).send({
        ...catalogProductBody(category.id, 'cake-1000'),
        description: 'ž'.repeat(1000),
      });
      expect(ok.status).toBe(201);
      expect(ok.body.description.length).toBe(1000);

      const tooLongCreate = await api('post', '/api/admin/catalog/products', admin).send({
        ...catalogProductBody(category.id, 'cake-1001'),
        description: 'ž'.repeat(1001),
      });
      expect(tooLongCreate.status).toBe(400);

      const created = await api('post', '/api/admin/catalog/products', admin).send(
        catalogProductBody(category.id, 'cake-update-length'),
      );
      const tooLongUpdate = await api(
        'patch',
        `/api/admin/catalog/products/${created.body.id}`,
        admin,
      ).send({ description: 'ž'.repeat(1001) });
      expect(tooLongUpdate.status).toBe(400);
    });

    it('does not apply the catalogue editorial limit to e-shop products', async () => {
      const admin = await tokenForRole(PrismaRole.ADMIN);
      const category = await shopCategory('plyteles');

      const res = await api('post', '/api/admin/shop/products', admin).send({
        ...shopProductBody(category.id, 'long-shop'),
        description: 'ž'.repeat(1001),
      });
      expect(res.status).toBe(201);
      expect(res.body.description.length).toBe(1001);
    });

    it('preserves an existing over-limit description until the employee shortens it', async () => {
      const admin = await tokenForRole(PrismaRole.ADMIN);
      const category = await catalogCategory('tortai');
      const long = 'ž'.repeat(1200);
      const created = await api('post', '/api/admin/catalog/products', admin).send(
        catalogProductBody(category.id, 'legacy-long'),
      );
      // Simulate a pre-existing (pre-limit) over-long record written directly.
      await prisma.catalogProduct.update({
        where: { id: created.body.id },
        data: { description: long },
      });

      // Listing never truncates or rewrites the stored content.
      const list = await api('get', '/api/admin/catalog/products', admin);
      const row = list.body.items.find((item: { id: string }) => item.id === created.body.id);
      expect(row.description).toBe(long);

      // Re-saving the over-limit text is rejected…
      const blocked = await api(
        'patch',
        `/api/admin/catalog/products/${created.body.id}`,
        admin,
      ).send({ description: long });
      expect(blocked.status).toBe(400);

      // …and shortening it succeeds.
      const shortened = await api(
        'patch',
        `/api/admin/catalog/products/${created.body.id}`,
        admin,
      ).send({ description: 'Sutrumpinta' });
      expect(shortened.status).toBe(200);
      expect(shortened.body.description).toBe('Sutrumpinta');
    });
  });
});
