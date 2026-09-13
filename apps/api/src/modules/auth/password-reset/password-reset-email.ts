import type { MailMessage } from '../../mail/mail.transport.js';
import { PASSWORD_RESET_ROUTE, PASSWORD_RESET_TTL_HOURS } from './password-reset.constants.js';

export interface PasswordResetEmailInput {
  webOrigin: string;
  token: string;
  ttlHours?: number;
}

/** Builds the public password-reset URL on the frontend origin. */
export function buildPasswordResetUrl(webOrigin: string, token: string): string {
  const origin = webOrigin.replace(/\/+$/, '');
  const params = new URLSearchParams({ token });
  return `${origin}${PASSWORD_RESET_ROUTE}?${params.toString()}`;
}

/**
 * Lithuanian password-reset content. Simple, no template engine.
 */
export function buildPasswordResetEmail(input: PasswordResetEmailInput): Omit<MailMessage, 'to'> {
  const ttlHours = input.ttlHours ?? PASSWORD_RESET_TTL_HOURS;
  const url = buildPasswordResetUrl(input.webOrigin, input.token);
  const subject = 'Slaptažodžio atkūrimas';
  const expiry = `Nuoroda galioja ${ttlHours} val.`;

  const text = [
    'Sveiki,',
    '',
    'Gavome prašymą atkurti šios paskyros slaptažodį. Norėdami nustatyti naują slaptažodį, spauskite šią nuorodą:',
    url,
    '',
    expiry,
    '',
    'Slaptažodis nebus pakeistas, kol nepasinaudosite šia nuoroda.',
    'Jei šio prašymo neteikėte, šį laišką galite tiesiog ignoruoti.',
    '',
    'Sokolado meistrai',
  ].join('\n');

  const html = [
    '<p>Sveiki,</p>',
    '<p>Gavome prašymą atkurti šios paskyros slaptažodį. Norėdami nustatyti naują slaptažodį, spauskite žemiau esančią nuorodą:</p>',
    `<p><a href="${url}">Nustatyti naują slaptažodį</a></p>`,
    `<p>${expiry}</p>`,
    '<p>Slaptažodis nebus pakeistas, kol nepasinaudosite šia nuoroda.</p>',
    '<p>Jei šio prašymo neteikėte, šį laišką galite tiesiog ignoruoti.</p>',
    '<p>Sokolado meistrai</p>',
  ].join('\n');

  return { subject, text, html };
}
