import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client.js';

export * from './generated/prisma/client.js';
export { PrismaPg };

/**
 * Creates a Prisma client using the PostgreSQL driver adapter required by
 * Prisma 7. Callers supply the connection string (normally from configuration).
 */
export function createPrismaClient(connectionString: string): PrismaClient {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}
