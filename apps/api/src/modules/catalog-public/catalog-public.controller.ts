import { Controller, Get, Param } from '@nestjs/common';
import {
  CatalogPublicService,
  type PublicCatalogCategory,
  type PublicCatalogProductDetail,
} from './catalog-public.service.js';

/**
 * Public (unauthenticated) informational catalogue reads for the `/tortai`
 * pages. Only published catalogue products in active CATALOG categories are
 * returned; anything else is a 404.
 */
@Controller('public/catalog')
export class CatalogPublicController {
  constructor(private readonly catalog: CatalogPublicService) {}

  @Get('categories/:slug')
  getCategory(@Param('slug') slug: string): Promise<PublicCatalogCategory> {
    return this.catalog.getCategory(slug);
  }

  @Get('products/:slug')
  getProduct(@Param('slug') slug: string): Promise<PublicCatalogProductDetail> {
    return this.catalog.getProduct(slug);
  }
}
