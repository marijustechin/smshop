import { Injectable, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient, PrismaPg } from '@smshop/db';

@Injectable()
export class PrismaService extends PrismaClient implements OnApplicationShutdown {
  constructor(config: ConfigService) {
    super({
      adapter: new PrismaPg({
        connectionString: config.getOrThrow<string>('DATABASE_URL'),
      }),
    });
  }

  async onApplicationShutdown(): Promise<void> {
    await this.$disconnect();
  }
}
