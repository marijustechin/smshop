import { Module } from '@nestjs/common';
import { JwtModule, type JwtModuleOptions, type JwtSignOptions } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { EmailVerificationService } from './email-verification/email-verification.service.js';
import { Argon2PasswordHasher } from './password/argon2-password-hasher.js';
import { PASSWORD_HASHER } from './password/password-hasher.js';
import { AccessTokenService } from './session/access-token.service.js';
import { AccessTokenGuard } from './session/access-token.guard.js';
import { AuthSessionService } from './session/auth-session.service.js';
import { RefreshCookieService } from './session/refresh-cookie.service.js';
import { MailModule } from '../mail/mail.module.js';

@Module({
  imports: [
    MailModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService): JwtModuleOptions => ({
        secret: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        signOptions: {
          expiresIn: config.get<string>(
            'JWT_ACCESS_TTL',
            '15m',
          ) as unknown as JwtSignOptions['expiresIn'],
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    EmailVerificationService,
    AuthSessionService,
    AccessTokenService,
    AccessTokenGuard,
    RefreshCookieService,
    { provide: PASSWORD_HASHER, useClass: Argon2PasswordHasher },
  ],
})
export class AuthModule {}
