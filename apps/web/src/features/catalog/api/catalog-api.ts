import { apiRequest } from '@/shared/api/client';
import type { PublicCatalogCategory, PublicCatalogProductDetail } from '../model/types';

/** Public (unauthenticated) catalogue reads. */

export function getCatalogCategory(
  slug: string,
  signal?: AbortSignal,
): Promise<PublicCatalogCategory> {
  return apiRequest<PublicCatalogCategory>(
    `/api/public/catalog/categories/${encodeURIComponent(slug)}`,
    { signal },
  );
}

export function getCatalogProduct(
  slug: string,
  signal?: AbortSignal,
): Promise<PublicCatalogProductDetail> {
  return apiRequest<PublicCatalogProductDetail>(
    `/api/public/catalog/products/${encodeURIComponent(slug)}`,
    { signal },
  );
}
