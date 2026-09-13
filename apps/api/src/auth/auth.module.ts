import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { Argon2PasswordHasher } from './password/argon2-password-hasher.js';
import { PASSWORD_HASHER } from './password/password-hasher.js';

@Module({
  controllers: [AuthController],
  providers: [AuthService, { provide: PASSWORD_HASHER, useClass: Argon2PasswordHasher }],
})
export class AuthModule {}
