/**
 * Shared public company configuration.
 *
 * Business contact groups and stores are administrator-managed persisted records
 * (SITE-003); they are read from `GET /api/public/contacts`, not from this file.
 * Only non-managed company legal details and the `tel:`/`mailto:` helpers remain
 * here so components keep a single implementation without duplicating values.
 */

export const COMPANY = {
  legalName: 'UAB „Šokolado meistrai“',
  code: '181690898',
  foundedYear: 2003,
} as const;

/** `tel:` href for a display number (keeps only digits and a leading `+`). */
export function telHref(phone: string): string {
  return `tel:${phone.replace(/[^+\d]/g, '')}`;
}

/** `mailto:` href for an address. */
export function mailtoHref(email: string): string {
  return `mailto:${email}`;
}
