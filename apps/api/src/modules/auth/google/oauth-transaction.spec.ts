import { describe, expect, it } from 'vitest';
import {
  decodeOAuthTransaction,
  deriveOAuthTransactionKey,
  encodeOAuthTransaction,
  OAUTH_TXN_TTL_SECONDS,
} from './oauth-transaction.js';

const key = deriveOAuthTransactionKey('a-test-jwt-access-secret-of-32-characters');
const transaction = { state: 'state-value', codeVerifier: 'verifier-value', nonce: 'nonce-value' };

describe('OAuth transaction cookie payloads', () => {
  it('round-trips a signed transaction', () => {
    const encoded = encodeOAuthTransaction(transaction, key);

    expect(decodeOAuthTransaction(encoded, key)).toEqual(transaction);
  });

  it('does not accept a payload signed with a different key', () => {
    const otherKey = deriveOAuthTransactionKey('a-completely-different-secret-value-32-ch');
    const encoded = encodeOAuthTransaction(transaction, key);

    expect(decodeOAuthTransaction(encoded, otherKey)).toBeNull();
  });

  it('rejects a tampered payload (state/verifier/nonce changed)', () => {
    const encoded = encodeOAuthTransaction(transaction, key);
    const [payload, signature] = encoded.split('.');
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Record<
      string,
      unknown
    >;
    decoded.state = 'attacker-state';
    const forgedPayload = Buffer.from(JSON.stringify(decoded), 'utf8').toString('base64url');

    expect(decodeOAuthTransaction(`${forgedPayload}.${signature}`, key)).toBeNull();
  });

  it('rejects a tampered signature', () => {
    const encoded = encodeOAuthTransaction(transaction, key);
    const [payload] = encoded.split('.');

    expect(decodeOAuthTransaction(`${payload}.AAAAtampered`, key)).toBeNull();
    expect(decodeOAuthTransaction(`${payload}.`, key)).toBeNull();
  });

  it('rejects a missing signature, malformed value, and unknown/garbage input', () => {
    expect(decodeOAuthTransaction(undefined, key)).toBeNull();
    expect(decodeOAuthTransaction('', key)).toBeNull();
    expect(decodeOAuthTransaction('not-base64url', key)).toBeNull();
    expect(decodeOAuthTransaction('a.b.c', key)).toBeNull();
  });

  it('rejects an unsigned plain base64url JSON payload (legacy/forged)', () => {
    const unsigned = Buffer.from(JSON.stringify(transaction), 'utf8').toString('base64url');

    expect(decodeOAuthTransaction(unsigned, key)).toBeNull();
  });

  it('rejects an expired transaction', () => {
    const now = 1_000_000;
    const encoded = encodeOAuthTransaction(transaction, key, now);
    const afterTtl = now + (OAUTH_TXN_TTL_SECONDS + 1) * 1000;

    expect(decodeOAuthTransaction(encoded, key, now + 1000)).toEqual(transaction);
    expect(decodeOAuthTransaction(encoded, key, afterTtl)).toBeNull();
  });
});
