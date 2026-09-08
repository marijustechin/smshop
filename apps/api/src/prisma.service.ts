import { Injectable, OnApplicationShutdown } from '@nestjs/common';
import { PrismaClient } from '@smshop/db';

@Injectable()
export class PrismaService extends PrismaClient implements OnApplicationShutdown {
  async onApplicationShutdown(): Promise<void> {
    await this.$disconnect();
  }
}
