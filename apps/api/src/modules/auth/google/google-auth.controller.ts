import { Controller, Get, Req, Res, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { GoogleAuthService } from './google-auth.service.js';

@Controller('auth/google')
export class GoogleAuthController {
  constructor(
    private readonly googleAuth: GoogleAuthService,
    private readonly config: ConfigService,
  ) {}

  /** Starts the Google Authorization Code flow (browser redirect). */
  @Get()
  async start(@Res() reply: FastifyReply): Promise<void> {
    const url = await this.googleAuth.start(reply);
    if (!url) {
      throw new ServiceUnavailableException('Google authentication is not available');
    }
    reply.redirect(url, 302);
  }

  /** Google OAuth callback. Never exposes tokens in the redirect URL. */
  @Get('callback')
  async callback(@Req() request: FastifyRequest, @Res() reply: FastifyReply): Promise<void> {
    const query = request.query as { state?: string; code?: string; error?: string };
    const webOrigin = this.config.getOrThrow<string>('WEB_ORIGIN');

    // Fail safe when Google is not configured instead of erroring: a disabled
    // deployment must never 500 on a stray callback request.
    if (!this.googleAuth.isEnabled()) {
      this.googleAuth.clearTransaction(reply);
      reply.redirect(`${webOrigin}/prisijungti?oauth=failed`, 302);
      return;
    }

    if (query.error) {
      // User denied/cancelled, or Google returned an error.
      this.googleAuth.clearTransaction(reply);
      reply.redirect(`${webOrigin}/prisijungti?oauth=failed`, 302);
      return;
    }

    const callbackBase = this.config.getOrThrow<string>('GOOGLE_CALLBACK_URL');
    const queryString = request.url.includes('?')
      ? request.url.slice(request.url.indexOf('?'))
      : '';
    const callbackUrl = `${callbackBase}${queryString}`;

    const outcome = await this.googleAuth.handleCallback(request, reply, callbackUrl, query.state);

    if (outcome.status === 'success') {
      reply.redirect(`${webOrigin}/prisijungti?oauth=success`, 302);
      return;
    }
    if (outcome.status === 'link_required') {
      reply.redirect(`${webOrigin}/prisijungti?oauth=account-link-required`, 302);
      return;
    }
    reply.redirect(`${webOrigin}/prisijungti?oauth=failed`, 302);
  }
}
