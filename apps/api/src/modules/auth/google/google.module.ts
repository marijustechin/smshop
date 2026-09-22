import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleAuthController } from './google-auth.controller.js';
import { GoogleAuthService } from './google-auth.service.js';
import { GoogleAccountService } from './google-account.service.js';
import { readGoogleOidcConfig, GOOGLE_OIDC_CONFIG } from './google.config.js';
import { OpenidClientGoogleProvider } from './openid-client-google.provider.js';
import { GOOGLE_OIDC_PROVIDER } from './google-oidc.provider.js';
import { OAuthTransactionCookieService } from './oauth-transaction-cookie.service.js';
import { AuthSessionModule } from '../session/auth-session.module.js';

@Module({
  imports: [AuthSessionModule],
  controllers: [GoogleAuthController],
  providers: [
    {
      provide: GOOGLE_OIDC_CONFIG,
      useFactory: (config: ConfigService) => readGoogleOidcConfig(config),
      inject: [ConfigService],
    },
    {
      provide: GOOGLE_OIDC_PROVIDER,
      useFactory: (config: ReturnType<typeof readGoogleOidcConfig>) =>
        new OpenidClientGoogleProvider(config),
      inject: [GOOGLE_OIDC_CONFIG],
    },
    GoogleAccountService,
    GoogleAuthService,
    OAuthTransactionCookieService,
  ],
  // Exported so the auth capability surface can report whether Google is
  // configured without duplicating the provider's enabled check.
  exports: [GoogleAuthService],
})
export class GoogleModule {}
