import { Module } from '@nestjs/common';
import { Argon2PasswordHasher } from './argon2-password-hasher.js';
import { PASSWORD_HASHER } from './password-hasher.js';

/**
 * Provides the password-hashing boundary so multiple feature modules (auth,
 * session timing equalization) share one implementation without duplicating the
 * provider registration.
 */
@Module({
  providers: [{ provide: PASSWORD_HASHER, useClass: Argon2PasswordHasher }],
  exports: [PASSWORD_HASHER],
})
export class PasswordModule {}
