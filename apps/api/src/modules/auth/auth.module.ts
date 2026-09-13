import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { EmailVerificationService } from './email-verification/email-verification.service.js';
import { PasswordResetService } from './password-reset/password-reset.service.js';
import { PasswordModule } from './password/password.module.js';
import { AuthSessionModule } from './session/auth-session.module.js';
import { GoogleModule } from './google/google.module.js';
import { MailModule } from '../mail/mail.module.js';

@Module({
  imports: [MailModule, PasswordModule, AuthSessionModule, GoogleModule],
  controllers: [AuthController],
  providers: [AuthService, EmailVerificationService, PasswordResetService],
})
export class AuthModule {}
