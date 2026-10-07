import { Module } from '@nestjs/common';
import { CatalogPublicController } from './catalog-public.controller.js';
import { CatalogPublicService } from './catalog-public.service.js';

/**
 * Public informational catalogue (no auth). `PrismaModule` is global.
 */
@Module({
  controllers: [CatalogPublicController],
  providers: [CatalogPublicService],
})
export class CatalogPublicModule {}
