const DEFAULT_RETURN_TO = '/paskyra';

/**
 * Returns a safe relative return path or the fallback. Rejects absolute URLs,
 * protocol-relative URLs (`//evil`), backslashes, and control characters so a
 * `returnTo` query parameter can never become an open redirect.
 */
export function safeReturnTo(
  value: string | null | undefined,
  fallback = DEFAULT_RETURN_TO,
): string {
  if (!value) {
    return fallback;
  }
  const candidate = value.trim();
  if (!candidate.startsWith('/')) {
    return fallback;
  }
  if (candidate.startsWith('//') || candidate.startsWith('/\\')) {
    return fallback;
  }
  if (candidate.includes('\\') || /[\u0000-\u001f]/.test(candidate)) {
    return fallback;
  }
  return candidate;
}
