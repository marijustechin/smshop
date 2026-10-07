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
import { CategoriesService } from './categories.service.js';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto.js';
import { ListQueryDto } from './dto/common.js';
import { CreateShopProductDto, UpdateShopProductDto } from './dto/shop-product.dto.js';
import { ShopProductsService } from './shop-products.service.js';

/**
 * Admin CRUD for the e-shop (SHOP scope categories and shop products). Money is
 * integer cents; public visibility additionally requires PUBLISHED and stock.
 */
@Controller('admin/shop')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles('admin')
export class AdminShopController {
  constructor(
    private readonly categories: CategoriesService,
    private readonly products: ShopProductsService,
  ) {}

  @Get('categories')
  listCategories() {
    return this.categories.list(ProductScope.SHOP);
  }

  @Post('categories')
  createCategory(@Body() dto: CreateCategoryDto) {
    return this.categories.create(ProductScope.SHOP, dto);
  }

  @Patch('categories/:id')
  updateCategory(@Param('id') id: string, @Body() dto: UpdateCategoryDto) {
    return this.categories.update(ProductScope.SHOP, id, dto);
  }

  @Delete('categories/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteCategory(@Param('id') id: string) {
    return this.categories.delete(ProductScope.SHOP, id);
  }

  @Get('products')
  listProducts(@Query() query: ListQueryDto) {
    return this.products.list(query.page, query.pageSize);
  }

  @Post('products')
  createProduct(@Body() dto: CreateShopProductDto) {
    return this.products.create(dto);
  }

  @Patch('products/:id')
  updateProduct(@Param('id') id: string, @Body() dto: UpdateShopProductDto) {
    return this.products.update(id, dto);
  }

  @Delete('products/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteProduct(@Param('id') id: string) {
    return this.products.delete(id);
  }
}
