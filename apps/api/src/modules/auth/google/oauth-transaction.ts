import { createHmac, hkdfSync, randomBytes, timingSafeEqual } from 'node:crypto';

export const OAUTH_TXN_TTL_SECONDS = 600;

export interface OAuthTransaction {
  state: string;
  codeVerifier: string;
  nonce: string;
}

interface OAuthTransactionPayload extends OAuthTransaction {
  exp: number;
}

const KEY_INFO = 'smshop-oauth-transaction-v1';

/**
 * Derives a dedicated HMAC key from the application secret. HKDF with a
 * distinct `info` label domain-separates this key from the JWT signing use of
 * the same secret, so no additional secret/configuration is required.
 */
export function deriveOAuthTransactionKey(secret: string): Buffer {
  return Buffer.from(
    hkdfSync('sha256', Buffer.from(secret, 'utf8'), Buffer.alloc(0), KEY_INFO, 32),
  );
}

function sign(payload: string, key: Buffer): string {
  return createHmac('sha256', key).update(payload).digest('base64url');
}

/**
 * Encodes a transaction as `base64url(payload).base64url(hmac)`. The signature
 * makes the cookie tamper-evident: a client cannot alter `state`, the PKCE
 * verifier, the nonce, or the expiry without invalidating the MAC.
 */
export function encodeOAuthTransaction(
  transaction: OAuthTransaction,
  key: Buffer,
  now: number = Date.now(),
): string {
  const payload: OAuthTransactionPayload = {
    state: transaction.state,
    codeVerifier: transaction.codeVerifier,
    nonce: transaction.nonce,
    exp: Math.floor(now / 1000) + OAUTH_TXN_TTL_SECONDS,
  };
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  return `${encoded}.${sign(encoded, key)}`;
}

/**
 * Verifies and decodes a transaction. Returns `null` for a missing/malformed
 * value, an invalid signature, any missing field, or an expired payload. The
 * signature is compared in constant time.
 */
export function decodeOAuthTransaction(
  value: string | undefined,
  key: Buffer,
  now: number = Date.now(),
): OAuthTransaction | null {
  if (!value) {
    return null;
  }

  const separator = value.lastIndexOf('.');
  if (separator <= 0 || separator === value.length - 1) {
    return null;
  }
  const encoded = value.slice(0, separator);
  const providedSignature = value.slice(separator + 1);

  const expectedSignature = sign(encoded, key);
  const provided = Buffer.from(providedSignature);
  const expected = Buffer.from(expectedSignature);
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return null;
  }

  let payload: Partial<OAuthTransactionPayload>;
  try {
    payload = JSON.parse(
      Buffer.from(encoded, 'base64url').toString('utf8'),
    ) as Partial<OAuthTransactionPayload>;
  } catch {
    return null;
  }

  if (!payload.state || !payload.codeVerifier || !payload.nonce) {
    return null;
  }
  if (typeof payload.exp !== 'number' || payload.exp * 1000 <= now) {
    return null;
  }

  return { state: payload.state, codeVerifier: payload.codeVerifier, nonce: payload.nonce };
}

/** Generates a fresh random value for state/nonce/verifier. */
export function generateTransactionSecret(): string {
  return randomBytes(32).toString('base64url');
}
