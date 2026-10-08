/**
 * Single shared source for public contact information (SITE-001).
 *
 * Values are transferred from the existing public site
 * `https://www.sokoladomeistrai.lt/kontaktai/` and the individual store pages.
 * The footer and the `/kontaktai` page both read from here so the values cannot
 * drift. Do not invent values; leave a comment when the source is ambiguous.
 */

export interface ContactChannel {
  readonly id: string;
  readonly title: string;
  /** Source hours are stated without weekdays; render them verbatim. */
  readonly hours: string;
  readonly phones: readonly string[];
  readonly email: string;
}

export type StoreStatus = 'open' | 'temporarily-closed' | 'closed';

export interface Store {
  readonly city: 'Vilnius' | 'Kaunas';
  readonly name: string;
  readonly address: string;
  readonly hours: string;
  readonly status: StoreStatus;
}

export const COMPANY = {
  legalName: 'UAB „Šokolado meistrai“',
  code: '181690898',
  foundedYear: 2003,
} as const;

export const CONTACT = {
  /** General contact shown in the footer (administration line + shared inbox). */
  generalPhone: '+370 612 85646',
  generalEmail: 'info@sokoladomeistrai.lt',
  address: 'Jeruzalės g. 16, LT-08414 Vilnius',
  channels: [
    {
      id: 'administracija',
      title: 'Administracija',
      hours: '8:00–18:00',
      phones: ['+370 612 85646'],
      email: 'info@sokoladomeistrai.lt',
    },
    {
      id: 'uzsakymai',
      title: 'Užsakymų skyrius',
      hours: '8:00–18:00',
      phones: ['+370 691 81928'],
      email: 'uzsakymai@sokoladomeistrai.lt',
    },
    {
      id: 'e-parduotuve',
      title: 'E-parduotuvė',
      hours: '8:00–18:00',
      phones: ['+370 612 81837'],
      email: 'gamyba@sokoladomeistrai.lt',
    },
  ] as readonly ContactChannel[],
  stores: [
    {
      city: 'Vilnius',
      name: 'Jeruzalės g. 16, Vilnius',
      address: 'Jeruzalės g. 16, LT-08414 Vilnius',
      hours: 'I–V 9:00–19:00; VI–VII 10:00–18:00',
      status: 'open',
    },
    {
      city: 'Vilnius',
      name: 'Fabijoniškių g. 2A, PC „IKI“',
      address: 'Fabijoniškių g. 2A, PC „IKI“, Vilnius',
      hours: 'Visomis dienomis 10:00–20:00',
      status: 'open',
    },
    {
      city: 'Vilnius',
      name: 'Kedrų g. 4, PC „RIMI“',
      address: 'Kedrų g. 4, PC „RIMI“, Vilnius',
      hours: 'Visomis dienomis 10:00–20:00',
      status: 'open',
    },
    {
      city: 'Vilnius',
      name: 'Upės g. 9, PC „CUP“',
      address: 'Upės g. 9, PC „CUP“, Vilnius',
      hours: 'Visomis dienomis 10:00–21:00',
      status: 'open',
    },
    {
      city: 'Vilnius',
      name: 'Žirmūnų g. 64, PC „RIMI“',
      address: 'Žirmūnų g. 64, PC „RIMI“, Vilnius',
      hours: 'I–VI 10:00–21:00; VII 10:00–20:00',
      status: 'open',
    },
    {
      city: 'Kaunas',
      name: 'Savanorių pr. 255, PC „HYPER MAXIMA“',
      address: 'Savanorių pr. 255, PC „HYPER MAXIMA“, Kaunas',
      hours: 'Visomis dienomis 10:00–21:00',
      status: 'open',
    },
    {
      city: 'Vilnius',
      name: 'Viršuliškių g. 40, PC „MADA“',
      address: 'Viršuliškių g. 40, PC „MADA“, Vilnius',
      hours: 'Laikinai uždaryta – vyksta rekonstrukcija',
      status: 'temporarily-closed',
    },
    {
      city: 'Vilnius',
      name: 'Vydūno g. 4, PC „RIMI“',
      address: 'Vydūno g. 4, PC „RIMI“, Vilnius',
      hours: 'Uždaryta nuo 2026-05-20',
      status: 'closed',
    },
  ] as readonly Store[],
} as const;

/** `tel:` href for a display number (keeps only digits and a leading `+`). */
export function telHref(phone: string): string {
  return `tel:${phone.replace(/[^+\d]/g, '')}`;
}

/** `mailto:` href for an address. */
export function mailtoHref(email: string): string {
  return `mailto:${email}`;
}
