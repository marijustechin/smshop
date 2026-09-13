import { describe, expect, it } from 'vitest';
import { ARGON2ID_PARAMS, Argon2PasswordHasher } from './argon2-password-hasher.js';

describe('Argon2PasswordHasher', () => {
  const hasher = new Argon2PasswordHasher();
  const password = 'correct horse battery staple';

  it('produces an Argon2id digest that is not the plaintext', async () => {
    const digest = await hasher.hash(password);

    expect(digest).not.toBe(password);
    expect(digest).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
    expect(digest).not.toContain(password);
  });

  it('embeds the configured parameters in the digest', async () => {
    const digest = await hasher.hash(password);

    expect(ARGON2ID_PARAMS.memoryCost).toBe(19456);
    expect(digest).toContain(`m=${ARGON2ID_PARAMS.memoryCost},t=${ARGON2ID_PARAMS.timeCost}`);
  });

  it('produces a different digest for the same password (salted)', async () => {
    const first = await hasher.hash(password);
    const second = await hasher.hash(password);

    expect(first).not.toBe(second);
  });

  it('verifies the correct password', async () => {
    const digest = await hasher.hash(password);

    await expect(hasher.verify(digest, password)).resolves.toBe(true);
  });

  it('rejects an incorrect password', async () => {
    const digest = await hasher.hash(password);

    await expect(hasher.verify(digest, 'not the password')).resolves.toBe(false);
  });

  it('returns false for a malformed digest instead of throwing', async () => {
    await expect(hasher.verify('not-a-valid-hash', password)).resolves.toBe(false);
  });
});
