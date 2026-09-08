import { ServiceUnavailableException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { HealthController } from './health.controller';
import type { PrismaService } from './prisma.service';

describe('HealthController', () => {
  const prisma = { $queryRaw: vi.fn() };

  it('returns ok when the authenticated DB query succeeds', async () => {
    prisma.$queryRaw.mockResolvedValue(1);

    const controller = new HealthController(prisma as unknown as PrismaService);
    await expect(controller.ready()).resolves.toEqual({ status: 'ok' });
  });

  it('throws ServiceUnavailableException when the DB query fails', async () => {
    prisma.$queryRaw.mockRejectedValue(new Error('database down'));

    const controller = new HealthController(prisma as unknown as PrismaService);
    await expect(controller.ready()).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
