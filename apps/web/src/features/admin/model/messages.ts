import { ApiError } from '@/shared/api/client';

/** User-facing Lithuanian labels for the wire roles. */
export const ROLE_LABELS: Record<string, string> = {
  user: 'Pirkėjas',
  editor: 'Redaktorius',
  admin: 'Administratorius',
};

/**
 * Maps an admin API failure to a concise Lithuanian message. Backend internals
 * and raw error bodies are never shown to the operator.
 */
export function describeAdminError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 403) {
      if (error.code === 'CANNOT_DELETE_SELF' || error.code === 'CANNOT_CHANGE_OWN_ROLE') {
        return 'Savo paties paskyros keisti negalima.';
      }
      return 'Neturite teisės atlikti šio veiksmo.';
    }
    if (error.status === 409 && error.code === 'LAST_ADMIN') {
      return 'Paskutinio administratoriaus pašalinti arba sumažinti teisių negalima.';
    }
    if (error.status === 404) {
      return 'Naudotojas nerastas.';
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
