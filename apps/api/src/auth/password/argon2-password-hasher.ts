import { Injectable } from '@nestjs/common';
import { Algorithm, hash, verify } from '@node-rs/argon2';
import type { PasswordHasher } from './password-hasher.js';

/**
 * Argon2id parameters (baseline, OWASP-recommended minimum):
 * - memoryCost: 19456 KiB (19 MiB)
 * - timeCost: 2 iterations
 * - parallelism: 1
 *
 * The resulting digest embeds the algorithm and parameters
 * (`$argon2id$v=19$m=19456,t=2,p=1$...`), so `verify` remains able to check
 * older digests after these parameters are raised in the future.
 */
export const ARGON2ID_PARAMS = {
  algorithm: Algorithm.Argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

@Injectable()
export class Argon2PasswordHasher implements PasswordHasher {
  async hash(plainPassword: string): Promise<string> {
    return hash(plainPassword, ARGON2ID_PARAMS);
  }

  async verify(passwordHash: string, plainPassword: string): Promise<boolean> {
    try {
      return await verify(passwordHash, plainPassword);
    } catch {
      return false;
    }
  }
}
