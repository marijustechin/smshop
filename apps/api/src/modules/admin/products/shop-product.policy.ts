import { ProductStatus, type Prisma } from '@smshop/db';

/**
 * Core Šokolado meistrai business rule: an e-shop product is publicly visible
 * only when it is PUBLISHED **and** has positive stock. Out-of-stock products
 * remain visible in the administration only (labelled “Nėra likučio”); they must
 * never appear in any public e-shop listing, search or filter. Public e-shop
 * reads must apply this filter.
 */
export const PUBLIC_SHOP_PRODUCT_WHERE: Prisma.ShopProductWhereInput = {
  status: ProductStatus.PUBLISHED,
  stockQuantity: { gt: 0 },
};

/** Returns a fresh copy of the public e-shop eligibility filter. */
export function publicShopProductWhere(): Prisma.ShopProductWhereInput {
  return { ...PUBLIC_SHOP_PRODUCT_WHERE };
}
