import type { PublicCatalogRating, PublicCatalogTag } from '../model/types';

/**
 * Visitor-facing tag label: the stored human name, locale-aware lowercased for
 * Lithuanian copy (`Šokoladas` -> `#šokoladas`). The machine slug is never shown
 * and remains unchanged in storage, API payloads and internal linking.
 */
export function tagLabel(name: string): string {
  return `#${name.trim().toLocaleLowerCase('lt-LT')}`;
}

/**
 * Compact, restrained tag chips. The `#` is presentation only and is never part
 * of the stored tag name/slug.
 */
export function TagChips({ tags, className }: { tags: PublicCatalogTag[]; className?: string }) {
  if (tags.length === 0) {
    return null;
  }
  return (
    <ul className={`flex flex-wrap gap-1.5 ${className ?? ''}`.trim()} aria-label="Žymos">
      {tags.map((tag) => (
        <li
          key={tag.slug}
          className="rounded-full bg-surface-muted px-2 py-0.5 text-xs font-medium text-text-muted"
        >
          {tagLabel(tag.name)}
        </li>
      ))}
    </ul>
  );
}

/** `4,9 (61)` with a leading star, using the imported values. */
export function formatRating(rating: PublicCatalogRating): string {
  return `★ ${rating.average.toFixed(1).replace('.', ',')} (${rating.count})`;
}

/**
 * Verified legacy rating badge. Renders nothing unless the API returned a
 * valid imported rating (score and positive count), so no placeholder stars
 * ever appear.
 */
export function RatingBadge({
  rating,
  className,
}: {
  rating: PublicCatalogRating | null;
  className?: string;
}) {
  if (!rating) {
    return null;
  }
  return (
    <span
      className={`inline-flex items-center text-sm font-medium text-primary ${className ?? ''}`.trim()}
      aria-label={`Įvertinimas ${rating.average.toFixed(1).replace('.', ',')} iš 5, ${rating.count} atsiliepimų`}
    >
      {formatRating(rating)}
    </span>
  );
}
