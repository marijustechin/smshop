import type { PublicStoreHour } from './types';

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

function dayValue(hour: PublicStoreHour): string {
  if (hour.closed) {
    return 'closed';
  }
  // Public output trims a leading zero to match the published source (`9:00`).
  const trim = (time: string | null) => (time ?? '').replace(/^0(?=\d:)/, '');
  return `${trim(hour.opens)}–${trim(hour.closes)}`;
}

/**
 * Compact weekly-hours label for public output. Identical consecutive days are
 * collapsed into ranges (e.g. `I–V 9:00–19:00; VI–VII 10:00–18:00`); when every
 * day is identical it renders `Visomis dienomis …`. Days are ISO-8601 (1 = Monday).
 */
export function formatWeeklyHours(hours: PublicStoreHour[]): string {
  const ordered = [...hours].sort((a, b) => a.weekday - b.weekday);
  if (ordered.length === 0) {
    return '';
  }

  const segments: { start: number; end: number; value: string }[] = [];
  for (const hour of ordered) {
    const value = dayValue(hour);
    const last = segments[segments.length - 1];
    if (last && last.value === value && last.end + 1 === hour.weekday) {
      last.end = hour.weekday;
    } else {
      segments.push({ start: hour.weekday, end: hour.weekday, value });
    }
  }

  if (segments.length === 1 && segments[0].start === 1 && segments[0].end === 7) {
    return segments[0].value === 'closed' ? 'Nedirba' : `Visomis dienomis ${segments[0].value}`;
  }

  return segments
    .map((segment) => {
      const label =
        segment.start === segment.end
          ? ROMAN[segment.start - 1]
          : `${ROMAN[segment.start - 1]}–${ROMAN[segment.end - 1]}`;
      return segment.value === 'closed' ? `${label} nedirba` : `${label} ${segment.value}`;
    })
    .join('; ');
}

/** Ordinary map-search link generated from the address (no coordinates/slugs). */
export function mapSearchUrl(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}
