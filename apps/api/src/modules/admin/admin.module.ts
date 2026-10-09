import { Module } from '@nestjs/common';
import { AuthSessionModule } from '../auth/session/auth-session.module.js';
import { AdminDashboardController } from './admin-dashboard.controller.js';
import { AdminUsersController } from './admin-users.controller.js';
import { AdminUsersService } from './admin-users.service.js';
import { RolesGuard } from './authorization/roles.guard.js';
import { InitialAdminBootstrapService } from './bootstrap/initial-admin-bootstrap.service.js';
import { AdminCatalogController } from './products/admin-catalog.controller.js';
import { AdminShopController } from './products/admin-shop.controller.js';
import { CatalogProductsService } from './products/catalog-products.service.js';
import { CatalogTagsService } from './products/catalog-tags.service.js';
import { CategoriesService } from './products/categories.service.js';
import { ShopProductsService } from './products/shop-products.service.js';
import { AdminContactsController } from './contacts/admin-contacts.controller.js';
import { CitiesService } from './contacts/cities.service.js';
import { ContactGroupsService } from './contacts/contact-groups.service.js';
import { StoresService } from './contacts/stores.service.js';

/**
 * Administration domain: role-guarded user management, dashboard summary, and
 * catalogue/e-shop category and product management (separate CATALOG and SHOP
 * scopes). `PrismaModule` is global; `AuthSessionModule` supplies the shared
 * `AccessTokenGuard`.
 */
@Module({
  imports: [AuthSessionModule],
  controllers: [
    AdminUsersController,
    AdminDashboardController,
    AdminCatalogController,
    AdminShopController,
    AdminContactsController,
  ],
  providers: [
    AdminUsersService,
    RolesGuard,
    InitialAdminBootstrapService,
    CategoriesService,
    CatalogProductsService,
    CatalogTagsService,
    ShopProductsService,
    CitiesService,
    StoresService,
    ContactGroupsService,
  ],
})
export class AdminModule {}
