import { ApiError } from '@/shared/api/client';
import type { ProductScope, ProductStatus } from './types';

export const SCOPE_LABELS: Record<ProductScope, string> = {
  CATALOG: 'Prekių katalogas',
  SHOP: 'El. parduotuvė',
};

export const STATUS_LABELS: Record<ProductStatus, string> = {
  DRAFT: 'Juodraštis',
  PUBLISHED: 'Publikuotas',
  HIDDEN: 'Paslėptas',
};

/** Formats integer cents as a Lithuanian euro price (e.g. 990 -> "9,90 €"). */
export function formatPriceCents(cents: number): string {
  return `${(cents / 100).toFixed(2).replace('.', ',')} €`;
}

/** Maps a product/category API failure to a concise Lithuanian message. */
export function describeProductError(error: unknown): string {
  if (error instanceof ApiError) {
    switch (error.code) {
      case 'SLUG_TAKEN':
        return 'Toks nuorodos fragmentas (slug) jau naudojamas šioje srityje.';
      case 'SKU_TAKEN':
        return 'Toks SKU jau naudojamas.';
      case 'CATEGORY_IN_USE':
        return 'Kategorijoje dar yra prekių. Pirma jas perkelkite arba pašalinkite.';
      case 'CATEGORY_HAS_CHILDREN':
        return 'Kategorija turi subkategorijų. Pirma jas pašalinkite.';
      case 'CATEGORY_SCOPE_MISMATCH':
        return 'Kategorija priklauso kitai sričiai (katalogas / el. parduotuvė).';
      case 'INVALID_PARENT':
        return 'Tėvinė kategorija turi priklausyti tai pačiai sričiai.';
      case 'CATEGORY_PARENT_SELF':
        return 'Kategorija negali būti pati sau tėvinė.';
      case 'CATEGORY_CYCLE':
        return 'Kategorijų hierarchijoje susidarytų ciklas.';
      case 'SALE_PRICE_NOT_LOWER':
        return 'Akcijos kaina turi būti mažesnė už bazinę kainą.';
      case 'SALE_END_BEFORE_START':
        return 'Akcijos pabaiga negali būti ankstesnė už pradžią.';
      case 'INVALID_IMAGE':
        return 'Netinkamas failas. Palaikomi tik JPEG, PNG ir WebP formatai.';
      case 'MEDIA_FILE_TOO_LARGE':
        return 'Nuotrauka per didelė (maks. 10 MB).';
      case 'MEDIA_FILE_REQUIRED':
        return 'Pasirinkite nuotraukos failą.';
      default:
        break;
    }
    if (error.status === 413) {
      return 'Nuotrauka per didelė (maks. 10 MB).';
    }
    if (error.status === 403) {
      return 'Neturite teisės atlikti šio veiksmo.';
    }
    if (error.status === 404) {
      return 'Įrašas nerastas.';
    }
    if (error.status === 400) {
      return 'Pateikti neteisingi duomenys.';
    }
    if (error.status === 401) {
      return 'Sesija nebegalioja. Prisijunkite iš naujo.';
    }
  }
  return 'Įvyko netikėta klaida. Bandykite dar kartą.';
}
