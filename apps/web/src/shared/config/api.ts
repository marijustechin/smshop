/**
 * Frontend API origin. In production the API is same-origin under `/api`, so the
 * base URL is empty. In development the frontend (3101) and API (3100) are
 * separate hosts, so `NEXT_PUBLIC_API_BASE_URL` must point at the API origin.
 * This is the single place the origin is resolved; components never hard-code it.
 */
const configured = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, '');

export const API_BASE_URL =
  configured && configured.length > 0
    ? configured
    : process.env.NODE_ENV === 'production'
      ? ''
      : 'http://localhost:3100';

export function apiUrl(path: string): string {
  return `${API_BASE_URL}${path}`;
}
