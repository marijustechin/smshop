import { Module } from '@nestjs/common';
import { JwtModule, type JwtModuleOptions, type JwtSignOptions } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthSessionService } from './auth-session.service.js';
import { AccessTokenService } from './access-token.service.js';
import { AccessTokenGuard } from './access-token.guard.js';
import { RefreshCookieService } from './refresh-cookie.service.js';
import { PasswordModule } from '../password/password.module.js';

/**
 * Shared A-005 session infrastructure (access JWT, server-side sessions, refresh
 * cookie). Consumed by both credentials authentication and Google
 * authentication so session issuance is not duplicated.
 */
@Module({
  imports: [
    PasswordModule,
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
  providers: [AccessTokenService, AuthSessionService, RefreshCookieService, AccessTokenGuard],
  exports: [AccessTokenService, AuthSessionService, RefreshCookieService, AccessTokenGuard],
})
export class AuthSessionModule {}
