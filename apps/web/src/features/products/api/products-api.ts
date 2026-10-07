import type {
  AdminCategory,
  AuthedRequest,
  CatalogProduct,
  CatalogProductInput,
  CatalogTag,
  CategoryInput,
  Paginated,
  ProductScope,
  ShopProduct,
  ShopProductInput,
  UploadedImage,
} from '../model/types';

/** Typed wrappers around the admin catalogue / e-shop endpoints. */

function segment(scope: ProductScope): string {
  return scope === 'CATALOG' ? 'catalog' : 'shop';
}

export function listCategories(
  request: AuthedRequest,
  scope: ProductScope,
): Promise<AdminCategory[]> {
  return request<AdminCategory[]>(`/api/admin/${segment(scope)}/categories`);
}

export function createCategory(
  request: AuthedRequest,
  scope: ProductScope,
  body: CategoryInput,
): Promise<AdminCategory> {
  return request<AdminCategory>(`/api/admin/${segment(scope)}/categories`, {
    method: 'POST',
    body,
  });
}

export function updateCategory(
  request: AuthedRequest,
  scope: ProductScope,
  id: string,
  body: Partial<CategoryInput>,
): Promise<AdminCategory> {
  return request<AdminCategory>(
    `/api/admin/${segment(scope)}/categories/${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      body,
    },
  );
}

export function deleteCategory(
  request: AuthedRequest,
  scope: ProductScope,
  id: string,
): Promise<void> {
  return request<void>(`/api/admin/${segment(scope)}/categories/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export function listProducts<TProduct extends CatalogProduct | ShopProduct>(
  request: AuthedRequest,
  scope: ProductScope,
  params: { page?: number; pageSize?: number } = {},
): Promise<Paginated<TProduct>> {
  const search = new URLSearchParams();
  if (params.page) {
    search.set('page', String(params.page));
  }
  if (params.pageSize) {
    search.set('pageSize', String(params.pageSize));
  }
  const query = search.toString();
  return request<Paginated<TProduct>>(
    `/api/admin/${segment(scope)}/products${query ? `?${query}` : ''}`,
  );
}

export function createCatalogProduct<
  TProduct extends CatalogProduct | ShopProduct = CatalogProduct,
>(
  request: AuthedRequest,
  scope: ProductScope,
  body: CatalogProductInput | ShopProductInput,
): Promise<TProduct> {
  return request<TProduct>(`/api/admin/${segment(scope)}/products`, {
    method: 'POST',
    body,
  });
}

export function updateProduct<TProduct extends CatalogProduct | ShopProduct = CatalogProduct>(
  request: AuthedRequest,
  scope: ProductScope,
  id: string,
  body: Partial<CatalogProductInput | ShopProductInput>,
): Promise<TProduct> {
  return request<TProduct>(`/api/admin/${segment(scope)}/products/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body,
  });
}

export function deleteProduct(
  request: AuthedRequest,
  scope: ProductScope,
  id: string,
): Promise<void> {
  return request<void>(`/api/admin/${segment(scope)}/products/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

/**
 * Uploads a product image as multipart/form-data and returns the stored image
 * metadata (with a stable `/media/products/...` URL). The request function must
 * pass a FormData body through untouched.
 */
export function uploadProductImage(request: AuthedRequest, file: File): Promise<UploadedImage> {
  const form = new FormData();
  form.append('file', file);
  return request<UploadedImage>('/api/admin/media/images', { method: 'POST', body: form });
}

/** Reusable catalogue tags (catalogue scope only). */
export function listCatalogTags(request: AuthedRequest): Promise<CatalogTag[]> {
  return request<CatalogTag[]>('/api/admin/catalog/tags');
}

/**
 * Creates or reuses a catalogue tag by human name. The server derives the slug;
 * the endpoint is idempotent by normalized slug, so identical names never
 * produce duplicates.
 */
export function createCatalogTag(request: AuthedRequest, name: string): Promise<CatalogTag> {
  return request<CatalogTag>('/api/admin/catalog/tags', { method: 'POST', body: { name } });
}
