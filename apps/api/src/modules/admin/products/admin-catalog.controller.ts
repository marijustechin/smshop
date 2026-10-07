import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ProductScope } from '@smshop/db';
import { AccessTokenGuard } from '../../auth/session/access-token.guard.js';
import { Roles } from '../authorization/roles.decorator.js';
import { RolesGuard } from '../authorization/roles.guard.js';
import { CatalogProductsService } from './catalog-products.service.js';
import { CatalogTagsService } from './catalog-tags.service.js';
import { CategoriesService } from './categories.service.js';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto.js';
import { CreateCatalogTagDto } from './dto/catalog-tag.dto.js';
import { CreateCatalogProductDto, UpdateCatalogProductDto } from './dto/catalog-product.dto.js';
import { ListQueryDto } from './dto/common.js';

/**
 * Admin CRUD for the informational catalogue (CATALOG scope categories,
 * reusable tags and catalogue products). No commercial fields exist here by
 * design; imported legacy ratings are read-only and never accepted as input.
 */
@Controller('admin/catalog')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles('admin')
export class AdminCatalogController {
  constructor(
    private readonly categories: CategoriesService,
    private readonly products: CatalogProductsService,
    private readonly tags: CatalogTagsService,
  ) {}

  @Get('categories')
  listCategories() {
    return this.categories.list(ProductScope.CATALOG);
  }

  @Post('categories')
  createCategory(@Body() dto: CreateCategoryDto) {
    return this.categories.create(ProductScope.CATALOG, dto);
  }

  @Patch('categories/:id')
  updateCategory(@Param('id') id: string, @Body() dto: UpdateCategoryDto) {
    return this.categories.update(ProductScope.CATALOG, id, dto);
  }

  @Delete('categories/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteCategory(@Param('id') id: string) {
    return this.categories.delete(ProductScope.CATALOG, id);
  }

  @Get('products')
  listProducts(@Query() query: ListQueryDto) {
    return this.products.list(query.page, query.pageSize);
  }

  // Tags are catalogue-only and reusable across products.
  @Get('tags')
  listTags() {
    return this.tags.list();
  }

  // Idempotent by normalized slug: returns the existing tag when one already
  // matches the typed name, so the admin UI cannot create duplicates.
  @Post('tags')
  @HttpCode(HttpStatus.OK)
  createTag(@Body() dto: CreateCatalogTagDto) {
    return this.tags.ensure(dto.name);
  }

  @Post('products')
  createProduct(@Body() dto: CreateCatalogProductDto) {
    return this.products.create(dto);
  }

  @Patch('products/:id')
  updateProduct(@Param('id') id: string, @Body() dto: UpdateCatalogProductDto) {
    return this.products.update(id, dto);
  }

  @Delete('products/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteProduct(@Param('id') id: string) {
    return this.products.delete(id);
  }
}
