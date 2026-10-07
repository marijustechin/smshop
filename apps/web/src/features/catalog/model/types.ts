/** Public catalogue projection returned by the public catalogue API. */
export interface PublicCatalogTag {
  name: string;
  slug: string;
}

/** Public rating, present only when a valid imported legacy rating exists. */
export interface PublicCatalogRating {
  average: number;
  count: number;
}

export interface PublicCatalogProduct {
  name: string;
  slug: string;
  description: string;
  primaryImageUrl: string;
  featured: boolean;
  displayOrder: number;
  tags: PublicCatalogTag[];
  rating: PublicCatalogRating | null;
}

export interface PublicCatalogCategory {
  category: { name: string; slug: string };
  products: PublicCatalogProduct[];
}

export interface PublicCatalogProductDetail extends PublicCatalogProduct {
  category: { name: string; slug: string };
}
