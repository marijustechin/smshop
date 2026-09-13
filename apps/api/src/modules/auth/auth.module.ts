import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { EmailVerificationService } from './email-verification/email-verification.service.js';
import { Argon2PasswordHasher } from './password/argon2-password-hasher.js';
import { PASSWORD_HASHER } from './password/password-hasher.js';
import { MailModule } from '../mail/mail.module.js';

@Module({
  imports: [MailModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    EmailVerificationService,
    { provide: PASSWORD_HASHER, useClass: Argon2PasswordHasher },
  ],
})
export class AuthModule {}
