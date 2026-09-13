import type { MailMessage } from '../../mail/mail.transport.js';
import {
  EMAIL_VERIFICATION_ROUTE,
  EMAIL_VERIFICATION_TTL_HOURS,
} from './email-verification.constants.js';

export interface VerificationEmailInput {
  webOrigin: string;
  token: string;
  ttlHours?: number;
}

/** Builds the public verification URL on the frontend origin. */
export function buildVerificationUrl(webOrigin: string, token: string): string {
  const origin = webOrigin.replace(/\/+$/, '');
  const params = new URLSearchParams({ token });
  return `${origin}${EMAIL_VERIFICATION_ROUTE}?${params.toString()}`;
}

/**
 * Lithuanian email-verification content. Simple, no template engine.
 */
export function buildVerificationEmail(input: VerificationEmailInput): Omit<MailMessage, 'to'> {
  const ttlHours = input.ttlHours ?? EMAIL_VERIFICATION_TTL_HOURS;
  const url = buildVerificationUrl(input.webOrigin, input.token);
  const subject = 'Patvirtinkite savo el. pašto adresą';
  const expiry = `Nuoroda galioja ${ttlHours} val.`;

  const text = [
    'Sveiki,',
    '',
    'Dėkojame, kad užsiregistravote. Norėdami patvirtinti savo el. pašto adresą, spauskite šią nuorodą:',
    url,
    '',
    expiry,
    '',
    'Jei šios registracijos neatlikote, šį laišką galite tiesiog ignoruoti.',
    '',
    'Sokolado meistrai',
  ].join('\n');

  const html = [
    '<p>Sveiki,</p>',
    '<p>Dėkojame, kad užsiregistravote. Norėdami patvirtinti savo el. pašto adresą, spauskite žemiau esančią nuorodą:</p>',
    `<p><a href="${url}">Patvirtinti el. pašto adresą</a></p>`,
    `<p>${expiry}</p>`,
    '<p>Jei šios registracijos neatlikote, šį laišką galite tiesiog ignoruoti.</p>',
    '<p>Sokolado meistrai</p>',
  ].join('\n');

  return { subject, text, html };
}
