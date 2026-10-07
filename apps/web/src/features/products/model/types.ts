export type ProductScope = 'CATALOG' | 'SHOP';
export type ProductStatus = 'DRAFT' | 'PUBLISHED' | 'HIDDEN';

export interface AdminCategory {
  id: string;
  scope: ProductScope;
  name: string;
  slug: string;
  parentId: string | null;
  displayOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CatalogTag {
  id: string;
  name: string;
  slug: string;
}

export interface CatalogProduct {
  id: string;
  categoryId: string;
  name: string;
  slug: string;
  description: string;
  primaryImageUrl: string;
  galleryImageUrls: string[];
  status: ProductStatus;
  featured: boolean;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
  category: { id: string; name: string; slug: string };
  tags: CatalogTag[];
}

/**
 * E-shop product. It is a distinct model, not a catalogue product extension:
 * it keeps its own commercial fields and a short description, and has no
 * catalogue tags.
 */
export interface ShopProduct {
  id: string;
  categoryId: string;
  name: string;
  slug: string;
  shortDescription: string;
  description: string;
  primaryImageUrl: string;
  galleryImageUrls: string[];
  status: ProductStatus;
  featured: boolean;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
  category: { id: string; name: string; slug: string };
  sku: string | null;
  priceCents: number;
  salePriceCents: number | null;
  saleStartsAt: string | null;
  saleEndsAt: string | null;
  stockQuantity: number;
}

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface CategoryInput {
  name: string;
  slug: string;
  parentId?: string | null;
  displayOrder?: number;
  isActive?: boolean;
}

export interface CatalogProductInput {
  categoryId: string;
  name: string;
  slug: string;
  description: string;
  primaryImageUrl: string;
  galleryImageUrls?: string[];
  tagIds?: string[];
  status?: ProductStatus;
  featured?: boolean;
  displayOrder?: number;
}

export interface ShopProductInput extends Omit<CatalogProductInput, 'tagIds'> {
  shortDescription: string;
  sku?: string | null;
  priceCents: number;
  salePriceCents?: number | null;
  saleStartsAt?: string | null;
  saleEndsAt?: string | null;
  stockQuantity?: number;
}

/** Safe metadata returned by the admin image-upload endpoint. */
export interface UploadedImage {
  key: string;
  url: string;
  width: number;
  height: number;
  mimeType: 'image/webp';
  sizeBytes: number;
}

/**
 * Authenticated request function supplied by the auth feature. Duplicated here
 * (as elsewhere) so this feature stays auth-agnostic and respects the FSD-lite
 * layer boundaries.
 */
export type AuthedRequest = <T>(
  path: string,
  options?: { method?: string; body?: unknown },
) => Promise<T>;
