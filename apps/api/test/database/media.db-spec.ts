import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaClient, ProductScope, Role as PrismaRole } from '@smshop/db';
import { PrismaService } from '../../src/modules/prisma/prisma.service.js';
import { AuthSessionService } from '../../src/modules/auth/session/auth-session.service.js';
import { createTestPrismaClient, truncateAll } from './helpers.js';
import { createAuthTestApp } from './auth-app.js';

describe('Media product images (real PostgreSQL + temp storage)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let sessions: AuthSessionService;
  let mediaDir: string;
  const sendMail = vi.fn();

  beforeAll(async () => {
    // Temporary storage directory provided by the test env (never the real local
    // storage directory); reset it so each run starts clean.
    mediaDir = process.env.MEDIA_STORAGE_DIR as string;
    rmSync(mediaDir, { recursive: true, force: true });
    prisma = createTestPrismaClient();
    ({ app } = await createAuthTestApp(prisma as unknown as PrismaService, sendMail));
    sessions = app.get(AuthSessionService);
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
    rmSync(mediaDir, { recursive: true, force: true });
  });

  beforeEach(async () => {
    sendMail.mockReset();
    sendMail.mockResolvedValue(undefined);
    await truncateAll(prisma);
  });

  async function tokenForRole(role: PrismaRole): Promise<string> {
    const email = `${role.toLowerCase()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
    const user = await prisma.user.create({
      data: { email, emailNormalized: email, role, emailVerifiedAt: new Date() },
    });
    const { accessToken } = await sessions.createSession(user.id);
    return accessToken;
  }

  function upload(
    buffer: Buffer,
    options: { token?: string; filename?: string; contentType?: string } = {},
  ) {
    const req = request(app.getHttpServer()).post('/api/admin/media/images');
    if (options.token) {
      req.set('Authorization', `Bearer ${options.token}`);
    }
    return req.attach('file', buffer, {
      filename: options.filename ?? 'photo.jpg',
      contentType: options.contentType ?? 'image/jpeg',
    });
  }

  const jpeg = (width = 40, height = 30) =>
    sharp({ create: { width, height, channels: 3, background: { r: 200, g: 60, b: 30 } } })
      .jpeg()
      .toBuffer();
  const png = () =>
    sharp({
      create: {
        width: 20,
        height: 20,
        channels: 4,
        background: { r: 10, g: 120, b: 40, alpha: 1 },
      },
    })
      .png()
      .toBuffer();
  const webp = () =>
    sharp({ create: { width: 20, height: 10, channels: 3, background: { r: 0, g: 0, b: 0 } } })
      .webp()
      .toBuffer();

  describe('authorization', () => {
    it('rejects unauthenticated, user and editor; allows admin', async () => {
      const buffer = await jpeg();
      expect((await upload(buffer)).status).toBe(401);

      const userToken = await tokenForRole(PrismaRole.USER);
      const editorToken = await tokenForRole(PrismaRole.EDITOR);
      expect((await upload(buffer, { token: userToken })).status).toBe(403);
      expect((await upload(buffer, { token: editorToken })).status).toBe(403);

      const adminToken = await tokenForRole(PrismaRole.ADMIN);
      expect((await upload(buffer, { token: adminToken })).status).toBe(201);
    });
  });

  describe('accepted formats and normalization', () => {
    it('normalizes JPEG, PNG and WebP to WebP and stores a uuid-named file', async () => {
      const adminToken = await tokenForRole(PrismaRole.ADMIN);

      for (const buffer of [await jpeg(), await png(), await webp()]) {
        const res = await upload(buffer, {
          token: adminToken,
          filename: 'original-name.jpg',
          contentType: 'image/jpeg',
        });
        expect(res.status).toBe(201);
        expect(res.body).toMatchObject({
          mimeType: 'image/webp',
          width: expect.any(Number),
          height: expect.any(Number),
          sizeBytes: expect.any(Number),
        });
        expect(res.body.key).toMatch(/^products\/[0-9a-f-]{36}\.webp$/);
        expect(res.body.url).toMatch(/^\/media\/products\/[0-9a-f-]{36}\.webp$/);
        // The original file name is never used.
        expect(res.body.key).not.toContain('original-name');
        const stored = join(mediaDir, res.body.key);
        expect(existsSync(stored)).toBe(true);
      }
    });

    it('does not upscale small images and bounds large ones to 2400px', async () => {
      const adminToken = await tokenForRole(PrismaRole.ADMIN);

      const small = await upload(await jpeg(40, 30), { token: adminToken });
      expect(small.body).toMatchObject({ width: 40, height: 30 });

      const large = await upload(await jpeg(3000, 200), { token: adminToken });
      expect(large.body.width).toBe(2400);
      expect(large.body.height).toBeLessThanOrEqual(2400);
    });
  });

  describe('rejected input', () => {
    it('rejects SVG, GIF and non-image content with a clear error', async () => {
      const adminToken = await tokenForRole(PrismaRole.ADMIN);
      const svg = Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg>',
      );
      const text = Buffer.from('definitely not an image');
      const gif = await sharp({
        create: { width: 10, height: 10, channels: 3, background: { r: 255, g: 255, b: 255 } },
      })
        .gif()
        .toBuffer();

      const svgRes = await upload(svg, {
        token: adminToken,
        filename: 'x.svg',
        contentType: 'image/svg+xml',
      });
      expect(svgRes.status).toBe(400);
      expect(svgRes.body.code).toBe('INVALID_IMAGE');

      const textRes = await upload(text, {
        token: adminToken,
        filename: 'x.png',
        contentType: 'image/png',
      });
      expect(textRes.status).toBe(400);
      expect(textRes.body.code).toBe('INVALID_IMAGE');

      const gifRes = await upload(gif, {
        token: adminToken,
        filename: 'x.gif',
        contentType: 'image/gif',
      });
      expect(gifRes.status).toBe(400);
      expect(gifRes.body.code).toBe('INVALID_IMAGE');
    });

    it('rejects an oversized upload with 413', async () => {
      const adminToken = await tokenForRole(PrismaRole.ADMIN);
      const oversized = Buffer.alloc(11 * 1024 * 1024, 1);

      const res = await upload(oversized, { token: adminToken });
      expect(res.status).toBe(413);
    });
  });

  describe('public serving', () => {
    it('serves a stored image with the correct content type and caches it', async () => {
      const adminToken = await tokenForRole(PrismaRole.ADMIN);
      const created = await upload(await jpeg(), { token: adminToken });

      const res = await request(app.getHttpServer()).get(created.body.url).buffer(true);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('image/webp');
      expect(res.headers['cache-control']).toContain('immutable');
      const bytes = Buffer.isBuffer(res.body) ? res.body.length : (res.text?.length ?? 0);
      expect(bytes).toBeGreaterThan(0);
    });

    it('returns 404 for unknown and traversal attempts', async () => {
      expect(
        (
          await request(app.getHttpServer()).get(
            '/media/products/00000000-0000-4000-8000-000000000000.webp',
          )
        ).status,
      ).toBe(404);
      expect(
        (await request(app.getHttpServer()).get('/media/products/not-a-uuid.webp')).status,
      ).toBe(404);
      expect(
        (await request(app.getHttpServer()).get('/media/products/..%2F..%2Fetc%2Fpasswd')).status,
      ).toBe(404);
      expect((await request(app.getHttpServer()).get('/media/products/')).status).toBe(404);
    });
  });

  describe('product data compatibility', () => {
    it('accepts the returned /media path and legacy https image URLs', async () => {
      const adminToken = await tokenForRole(PrismaRole.ADMIN);
      const created = await upload(await jpeg(), { token: adminToken });
      const category = await prisma.category.create({
        data: { scope: ProductScope.CATALOG, name: 'Tortai', slug: 'tortai' },
      });

      const uploaded = await request(app.getHttpServer())
        .post('/api/admin/catalog/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          categoryId: category.id,
          name: 'Tortas',
          slug: 'tortas',
          description: 'Ilgas',
          primaryImageUrl: created.body.url,
        });
      expect(uploaded.status).toBe(201);
      expect(uploaded.body.primaryImageUrl).toBe(created.body.url);

      const legacy = await request(app.getHttpServer())
        .post('/api/admin/catalog/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          categoryId: category.id,
          name: 'Senas tortas',
          slug: 'senas-tortas',
          description: 'Ilgas',
          primaryImageUrl: 'https://old-wordpress.example.com/wp-content/uploads/cake.jpg',
        });
      expect(legacy.status).toBe(201);
      expect(legacy.body.primaryImageUrl).toBe(
        'https://old-wordpress.example.com/wp-content/uploads/cake.jpg',
      );
    });
  });
});
