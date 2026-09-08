import { INestApplication, RequestMethod } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma.service';

describe('Readiness endpoints (HTTP)', () => {
  let app: INestApplication;
  const prisma = { $queryRaw: vi.fn() };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api', {
      exclude: [{ path: 'health/ready', method: RequestMethod.GET }],
    });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health/ready returns 200 when the DB query succeeds', async () => {
    prisma.$queryRaw.mockResolvedValue(1);

    const res = await request(app.getHttpServer()).get('/health/ready');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('GET /health/ready returns 503 when the DB query fails', async () => {
    prisma.$queryRaw.mockRejectedValue(new Error('database down'));

    const res = await request(app.getHttpServer()).get('/health/ready');
    expect(res.status).toBe(503);
  });

  it('GET /api returns 200 (API owns /api)', async () => {
    const res = await request(app.getHttpServer()).get('/api');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ service: 'api', status: 'ok' });
  });

  it('GET /api/health/ready returns 404 (readiness is not under /api)', async () => {
    const res = await request(app.getHttpServer()).get('/api/health/ready');
    expect(res.status).toBe(404);
  });
});
