import { ApiError } from '@/lib/api/client';

/** Lithuanian user-facing auth messages. Never exposes backend internals. */
export const AUTH_MESSAGES = {
  invalidCredentials: 'Neteisingas el. paštas arba slaptažodis.',
  emailNotVerified: 'Jūsų el. pašto adresas dar nepatvirtintas.',
  duplicateEmail: 'Paskyra su šiuo el. pašto adresu jau egzistuoja.',
  network: 'Nepavyko susisiekti su serveriu. Patikrinkite interneto ryšį ir bandykite dar kartą.',
  generic: 'Įvyko netikėta klaida. Bandykite dar kartą vėliau.',
  invalidToken: 'Nuoroda netinkama.',
  expiredToken: 'Nuorodos galiojimo laikas baigėsi.',
  usedToken: 'Ši nuoroda jau buvo panaudota.',
  rateLimited: 'Per daug bandymų. Prašome šiek tiek palaukti ir bandyti dar kartą.',
  turnstile: 'Nepavyko patvirtinti, kad nesate robotas. Bandykite dar kartą.',
} as const;

/** Maps a caught error to a safe Lithuanian message. */
export function mapAuthError(error: unknown, fallback = AUTH_MESSAGES.generic): string {
  if (error instanceof ApiError) {
    if (error.status === 0) {
      return AUTH_MESSAGES.network;
    }
    if (error.status === 429) {
      return AUTH_MESSAGES.rateLimited;
    }
    if (
      error.status === 403 &&
      (error.code === 'TURNSTILE_REQUIRED' || error.code === 'TURNSTILE_FAILED')
    ) {
      return AUTH_MESSAGES.turnstile;
    }
    if (error.status === 401) {
      return AUTH_MESSAGES.invalidCredentials;
    }
    if (error.status === 403 && error.code === 'EMAIL_NOT_VERIFIED') {
      return AUTH_MESSAGES.emailNotVerified;
    }
    if (error.status === 409) {
      return AUTH_MESSAGES.duplicateEmail;
    }
    if (error.status === 410) {
      return AUTH_MESSAGES.expiredToken;
    }
    if (error.status === 400) {
      return AUTH_MESSAGES.invalidToken;
    }
  }
  return fallback;
}

export function isEmailNotVerified(error: unknown): boolean {
  return error instanceof ApiError && error.status === 403 && error.code === 'EMAIL_NOT_VERIFIED';
}
