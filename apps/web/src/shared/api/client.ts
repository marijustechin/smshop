import { apiUrl } from '@/shared/config/api';

/** Normalized API error exposed to the UI. Never carries backend internals. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** True when the caller has no valid session (missing/invalid token/cookie). */
  get isUnauthenticated(): boolean {
    return this.status === 401;
  }
}

interface ErrorBody {
  message?: string | string[];
  code?: string;
  error?: string;
}

function normalizeMessage(body: unknown, fallback: string): string {
  if (body && typeof body === 'object') {
    const message = (body as ErrorBody).message;
    if (Array.isArray(message)) {
      return message.join(', ');
    }
    if (typeof message === 'string' && message.length > 0) {
      return message;
    }
  }
  return fallback;
}

export interface RequestOptions {
  method?: string;
  body?: unknown;
  accessToken?: string;
  signal?: AbortSignal;
}

/**
 * Thin `fetch` wrapper for the smShop API. Always sends cookies (credentials)
 * so the httpOnly refresh cookie flows, and attaches the bearer access token
 * only when explicitly provided. No token is ever logged.
 */
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (options.accessToken) {
    headers.Authorization = `Bearer ${options.accessToken}`;
  }

  let response: Response;
  try {
    response = await fetch(apiUrl(path), {
      method: options.method ?? 'GET',
      headers,
      credentials: 'include',
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal,
    });
  } catch {
    throw new ApiError(0, 'network_error');
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  let parsed: unknown = undefined;
  if (text.length > 0) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = undefined;
    }
  }

  if (!response.ok) {
    throw new ApiError(
      response.status,
      normalizeMessage(parsed, response.statusText || 'request_failed'),
      parsed && typeof parsed === 'object' ? (parsed as ErrorBody).code : undefined,
    );
  }

  return parsed as T;
}
