import { describe, expect, it, vi } from 'vitest';
import type { ConfigService } from '@nestjs/config';
import {
  CloudflareTurnstileVerifier,
  TURNSTILE_SITEVERIFY_URL,
  type FetchLike,
} from './cloudflare-turnstile-verifier.js';

function configWith(secret?: string): ConfigService {
  return { get: () => secret } as unknown as ConfigService;
}

function jsonResponse(body: unknown, ok = true): Response {
  return {
    ok,
    json: async () => body,
  } as unknown as Response;
}

describe('CloudflareTurnstileVerifier', () => {
  it('is disabled and allows verification when no secret is configured', async () => {
    const verifier = new CloudflareTurnstileVerifier(configWith(undefined));
    expect(verifier.isEnabled()).toBe(false);
    await expect(verifier.verify(undefined)).resolves.toBe('ok');
  });

  it('treats an empty secret as unset', () => {
    const verifier = new CloudflareTurnstileVerifier(configWith(''));
    expect(verifier.isEnabled()).toBe(false);
  });

  it('reports a missing token when enabled', async () => {
    const verifier = new CloudflareTurnstileVerifier(configWith('secret-key'));
    await expect(verifier.verify(undefined)).resolves.toBe('missing');
    await expect(verifier.verify('')).resolves.toBe('missing');
  });

  it('verifies against Siteverify and accepts a successful challenge', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ success: true })) as unknown as FetchLike;
    const verifier = new CloudflareTurnstileVerifier(configWith('secret-key'), fetchImpl);

    await expect(verifier.verify('token', '203.0.113.7')).resolves.toBe('ok');

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(url).toBe(TURNSTILE_SITEVERIFY_URL);
    const params = init.body as URLSearchParams;
    expect(params.get('secret')).toBe('secret-key');
    expect(params.get('response')).toBe('token');
    expect(params.get('remoteip')).toBe('203.0.113.7');
  });

  it('rejects when Cloudflare reports failure', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ success: false, 'error-codes': ['invalid-input-response'] }),
    ) as unknown as FetchLike;
    const verifier = new CloudflareTurnstileVerifier(configWith('secret-key'), fetchImpl);

    await expect(verifier.verify('bad')).resolves.toBe('failed');
  });

  it('fails safe on a non-2xx provider response', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({}, false)) as unknown as FetchLike;
    const verifier = new CloudflareTurnstileVerifier(configWith('secret-key'), fetchImpl);

    await expect(verifier.verify('token')).resolves.toBe('unavailable');
  });

  it('fails safe on a malformed provider response', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ unexpected: true })) as unknown as FetchLike;
    const verifier = new CloudflareTurnstileVerifier(configWith('secret-key'), fetchImpl);

    await expect(verifier.verify('token')).resolves.toBe('unavailable');
  });

  it('fails safe on a network/provider failure', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('ECONNRESET');
    }) as unknown as FetchLike;
    const verifier = new CloudflareTurnstileVerifier(configWith('secret-key'), fetchImpl);

    await expect(verifier.verify('token')).resolves.toBe('unavailable');
  });
});
