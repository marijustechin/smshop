import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaClient, Role, StoreStatus } from '@smshop/db';
import { PrismaService } from '../../src/modules/prisma/prisma.service.js';
import { AuthSessionService } from '../../src/modules/auth/session/auth-session.service.js';
import { createTestPrismaClient, truncateAll } from './helpers.js';
import { createAuthTestApp } from './auth-app.js';

interface StoreHourRow {
  weekday: number;
  closed: boolean;
  opens: string | null;
  closes: string | null;
}

/** Seven open weekday rows, or a closed day when `closed` is true. */
function weeklyHours(closed = false): StoreHourRow[] {
  return Array.from({ length: 7 }, (_, index) => ({
    weekday: index + 1,
    closed,
    opens: closed ? null : '10:00',
    closes: closed ? null : '20:00',
  }));
}

function hourPayload(closed = false): StoreHourRow[] {
  return weeklyHours(closed);
}

function seedMigrationStatements(): string[] {
  const here = dirname(fileURLToPath(import.meta.url));
  const migrationsDir = resolve(here, '../../../../packages/db/prisma/migrations');
  const seedDir = readdirSync(migrationsDir).find((name) => name.endsWith('_seed_contacts'));
  if (!seedDir) {
    throw new Error('seed_contacts migration not found');
  }
  return readFileSync(join(migrationsDir, seedDir, 'migration.sql'), 'utf8')
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('--'))
    .join('\n')
    .split(';')
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0);
}

describe('Administrator contacts and stores (real PostgreSQL)', () => {
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

  async function createUser(email: string, role: Role) {
    return prisma.user.create({
      data: {
        email,
        emailNormalized: email.toLowerCase(),
        role,
        emailVerifiedAt: new Date(),
      },
    });
  }

  async function tokenFor(role: Role, email = `${role.toLowerCase()}@example.com`) {
    const user = await createUser(email, role);
    const { accessToken } = await sessions.createSession(user.id);
    return accessToken;
  }

  async function createCity(name: string, displayOrder = 0) {
    return prisma.city.create({
      data: { name, nameNormalized: name.trim().toLowerCase(), displayOrder },
    });
  }

  async function createStore(options: {
    cityId: string;
    name: string;
    status?: StoreStatus;
    notice?: string | null;
    displayOrder?: number;
  }) {
    return prisma.store.create({
      data: {
        cityId: options.cityId,
        name: options.name,
        address: `${options.name}, Vilnius`,
        status: options.status ?? StoreStatus.OPERATING,
        notice: options.notice ?? null,
        displayOrder: options.displayOrder ?? 0,
        hours: {
          create: weeklyHours(
            options.status !== undefined && options.status !== StoreStatus.OPERATING,
          ),
        },
      },
    });
  }

  function getPublic() {
    return request(app.getHttpServer()).get('/api/public/contacts');
  }

  function getCities(token?: string) {
    const req = request(app.getHttpServer()).get('/api/admin/contacts/cities');
    if (token) {
      req.set('Authorization', `Bearer ${token}`);
    }
    return req;
  }

  describe('public read boundary', () => {
    it('serves contacts without authentication', async () => {
      const res = await getPublic();
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ groups: [], cities: [] });
    });

    it('groups visible stores by ordered city, excludes hidden and omits empty cities', async () => {
      const vilnius = await createCity('Vilnius', 0);
      const kaunas = await createCity('Kaunas', 1);
      await createCity('Klaipėda', 2);

      await createStore({ cityId: vilnius.id, name: 'Upės g. 9', displayOrder: 1 });
      await createStore({ cityId: vilnius.id, name: 'Jeruzalės g. 16', displayOrder: 0 });
      await createStore({
        cityId: vilnius.id,
        name: 'Vydūno g. 4',
        status: StoreStatus.HIDDEN,
        displayOrder: 2,
      });
      await createStore({ cityId: kaunas.id, name: 'Savanorių pr. 255' });

      const res = await getPublic();
      expect(res.status).toBe(200);
      expect(res.body.cities.map((city: { name: string }) => city.name)).toEqual([
        'Vilnius',
        'Kaunas',
      ]);
      expect(res.body.cities[0].stores.map((store: { name: string }) => store.name)).toEqual([
        'Jeruzalės g. 16',
        'Upės g. 9',
      ]);
      expect(JSON.stringify(res.body)).not.toContain('Vydūno');
    });

    it('shows a closure notice for a temporarily closed store instead of normal hours', async () => {
      const vilnius = await createCity('Vilnius');
      await createStore({
        cityId: vilnius.id,
        name: 'MADA',
        status: StoreStatus.TEMPORARILY_CLOSED,
        notice: 'Laikinai uždaryta – vyksta rekonstrukcija',
      });

      const res = await getPublic();
      const store = res.body.cities[0].stores[0];
      expect(store.status).toBe('TEMPORARILY_CLOSED');
      expect(store.notice).toBe('Laikinai uždaryta – vyksta rekonstrukcija');
      // Raw hours rows are never exposed as an applicable schedule.
      expect(Object.keys(store).sort()).toEqual(
        ['address', 'email', 'hours', 'name', 'notice', 'phone', 'status'].sort(),
      );
    });
  });

  describe('admin authorization', () => {
    it('rejects unauthenticated and non-admin requests', async () => {
      expect((await getCities()).status).toBe(401);
      expect((await getCities(await tokenFor(Role.USER, 'user@example.com'))).status).toBe(403);
      expect((await getCities(await tokenFor(Role.EDITOR, 'editor@example.com'))).status).toBe(403);
    });

    it('serves an administrator', async () => {
      const token = await tokenFor(Role.ADMIN, 'admin@example.com');
      const res = await getCities(token);
      expect(res.status).toBe(200);
    });
  });

  describe('cities', () => {
    it('prevents duplicate names after trimming and case normalization', async () => {
      const token = await tokenFor(Role.ADMIN);
      const first = await request(app.getHttpServer())
        .post('/api/admin/contacts/cities')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Vilnius', displayOrder: 0 });
      expect(first.status).toBe(201);

      const duplicate = await request(app.getHttpServer())
        .post('/api/admin/contacts/cities')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: '  vILNIUS  ', displayOrder: 1 });
      expect(duplicate.status).toBe(409);
      expect(duplicate.body.code).toBe('CITY_DUPLICATE');
    });

    it('prevents deleting a city that still contains stores', async () => {
      const token = await tokenFor(Role.ADMIN);
      const city = await createCity('Vilnius');
      await createStore({ cityId: city.id, name: 'Upės g. 9' });

      const blocked = await request(app.getHttpServer())
        .delete(`/api/admin/contacts/cities/${city.id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(blocked.status).toBe(409);
      expect(blocked.body.code).toBe('CITY_HAS_STORES');

      const emptyCity = await createCity('Kaunas', 1);
      const removed = await request(app.getHttpServer())
        .delete(`/api/admin/contacts/cities/${emptyCity.id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(removed.status).toBe(204);
      await expect(prisma.city.findUnique({ where: { id: emptyCity.id } })).resolves.toBeNull();
    });
  });

  describe('stores', () => {
    it('creates a store with a weekly schedule and persists its status', async () => {
      const token = await tokenFor(Role.ADMIN);
      const city = await createCity('Vilnius');

      const res = await request(app.getHttpServer())
        .post('/api/admin/contacts/stores')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Upės g. 9',
          cityId: city.id,
          address: 'Upės g. 9, Vilnius',
          status: 'TEMPORARILY_CLOSED',
          notice: 'Laikinai uždaryta',
          displayOrder: 3,
          hours: hourPayload(true),
        });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('TEMPORARILY_CLOSED');
      expect(res.body.hours).toHaveLength(7);
      expect(res.body.city).toEqual({ id: city.id, name: 'Vilnius', displayOrder: 0 });
      await expect(prisma.storeHours.count({ where: { storeId: res.body.id } })).resolves.toBe(7);
    });

    it('rejects an unknown city and an invalid opening/closing time', async () => {
      const token = await tokenFor(Role.ADMIN);

      const unknownCity = await request(app.getHttpServer())
        .post('/api/admin/contacts/stores')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'X',
          cityId: '00000000-0000-7000-8000-000000000000',
          address: 'X',
          hours: hourPayload(),
        });
      expect(unknownCity.status).toBe(400);
      expect(unknownCity.body.code).toBe('CITY_NOT_FOUND');

      const city = await createCity('Vilnius');
      const badHours = hourPayload();
      badHours[0] = { weekday: 1, closed: false, opens: '18:00', closes: '09:00' };
      const invalid = await request(app.getHttpServer())
        .post('/api/admin/contacts/stores')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'X', cityId: city.id, address: 'X', hours: badHours });
      expect(invalid.status).toBe(400);
      await expect(prisma.store.count()).resolves.toBe(0);
    });
  });

  describe('contact groups', () => {
    it('reflects an administrator edit in the public endpoint', async () => {
      const token = await tokenFor(Role.ADMIN);
      await prisma.contactGroup.create({
        data: {
          key: 'administracija',
          title: 'Administracija',
          phone: '+370 600 00000',
          email: 'old@example.com',
          hours: '8:00–18:00',
          displayOrder: 0,
        },
      });

      const updated = await request(app.getHttpServer())
        .patch('/api/admin/contacts/groups/administracija')
        .set('Authorization', `Bearer ${token}`)
        .send({ phone: '+370 611 11111', email: 'naujas@example.com' });
      expect(updated.status).toBe(200);

      const res = await getPublic();
      expect(res.body.groups[0]).toMatchObject({
        key: 'administracija',
        phone: '+370 611 11111',
        email: 'naujas@example.com',
      });
    });

    it('returns 404 for an unknown group key', async () => {
      const token = await tokenFor(Role.ADMIN);
      const res = await request(app.getHttpServer())
        .patch('/api/admin/contacts/groups/nezinoma')
        .set('Authorization', `Bearer ${token}`)
        .send({ phone: '+370 600 00000' });
      expect(res.status).toBe(404);
    });
  });

  describe('initial data import', () => {
    it('applies the versioned seed repeat-safely and preserves closure/hidden state', async () => {
      const statements = seedMigrationStatements();
      for (const statement of statements) {
        await prisma.$executeRawUnsafe(statement);
      }
      const first = {
        cities: await prisma.city.count(),
        stores: await prisma.store.count(),
        hours: await prisma.storeHours.count(),
        groups: await prisma.contactGroup.count(),
      };
      // Re-applying must not overwrite or duplicate anything.
      for (const statement of statements) {
        await prisma.$executeRawUnsafe(statement);
      }
      const second = {
        cities: await prisma.city.count(),
        stores: await prisma.store.count(),
        hours: await prisma.storeHours.count(),
        groups: await prisma.contactGroup.count(),
      };

      expect(first).toEqual({ cities: 2, stores: 8, hours: 56, groups: 3 });
      expect(second).toEqual(first);

      const mada = await prisma.store.findFirst({
        where: { status: StoreStatus.TEMPORARILY_CLOSED },
      });
      expect(mada?.notice).toBeTruthy();
      const hidden = await prisma.store.findFirst({ where: { status: StoreStatus.HIDDEN } });
      expect(hidden).not.toBeNull();
    });
  });
});
