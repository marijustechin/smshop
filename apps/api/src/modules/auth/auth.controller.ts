import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { AuthService, type RegisteredUser } from './auth.service.js';
import { EmailVerificationService } from './email-verification/email-verification.service.js';
import { PasswordResetService } from './password-reset/password-reset.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { ResendVerificationDto } from './dto/resend-verification.dto.js';
import { VerifyEmailDto } from './dto/verify-email.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { ForgotPasswordDto } from './dto/forgot-password.dto.js';
import { ResetPasswordDto } from './dto/reset-password.dto.js';
import {
  AuthSessionService,
  type PublicUser,
  type RefreshResult,
} from './session/auth-session.service.js';
import { AccessTokenGuard } from './session/access-token.guard.js';
import type { AuthenticatedIdentity } from './session/access-token.service.js';
import { CurrentIdentity } from './session/current-identity.decorator.js';
import { REFRESH_COOKIE_NAME, RefreshCookieService } from './session/refresh-cookie.service.js';
import { TurnstileGuard } from './security/turnstile/turnstile.guard.js';
import { RateLimitGuard } from './security/rate-limit/rate-limit.guard.js';
import { RateLimit } from './security/rate-limit/rate-limit.decorator.js';

const GENERIC_RESEND_MESSAGE = 'If an eligible account exists, a verification email will be sent.';
const GENERIC_FORGOT_MESSAGE =
  'If an eligible account exists, password reset instructions will be sent.';

const MINUTE = 60_000;
const TEN_MINUTES = 600_000;

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly emailVerification: EmailVerificationService,
    private readonly passwordReset: PasswordResetService,
    private readonly sessions: AuthSessionService,
    private readonly refreshCookie: RefreshCookieService,
  ) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @RateLimit({ name: 'register', limit: 5, windowMs: TEN_MINUTES })
  @UseGuards(RateLimitGuard, TurnstileGuard)
  register(@Body() dto: RegisterDto): Promise<RegisteredUser> {
    return this.authService.register(dto);
  }

  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @RateLimit({ name: 'verify-email', limit: 20, windowMs: TEN_MINUTES })
  @UseGuards(RateLimitGuard)
  verifyEmail(@Body() dto: VerifyEmailDto): Promise<{ verified: true }> {
    return this.emailVerification.verify(dto.token);
  }

  @Post('resend-verification')
  @HttpCode(HttpStatus.ACCEPTED)
  @RateLimit({ name: 'resend-verification', limit: 3, windowMs: TEN_MINUTES })
  @UseGuards(RateLimitGuard, TurnstileGuard)
  async resendVerification(@Body() dto: ResendVerificationDto): Promise<{ message: string }> {
    await this.emailVerification.resend(dto.email);
    return { message: GENERIC_RESEND_MESSAGE };
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.ACCEPTED)
  @RateLimit({ name: 'forgot-password', limit: 3, windowMs: TEN_MINUTES })
  @UseGuards(RateLimitGuard, TurnstileGuard)
  async forgotPassword(@Body() dto: ForgotPasswordDto): Promise<{ message: string }> {
    await this.passwordReset.forgotPassword(dto.email);
    return { message: GENERIC_FORGOT_MESSAGE };
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @RateLimit({ name: 'reset-password', limit: 20, windowMs: TEN_MINUTES })
  @UseGuards(RateLimitGuard)
  resetPassword(@Body() dto: ResetPasswordDto): Promise<{ passwordReset: true }> {
    return this.passwordReset.resetPassword(dto.token, dto.password);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @RateLimit({ name: 'login', limit: 5, windowMs: MINUTE })
  @UseGuards(RateLimitGuard, TurnstileGuard)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<{ accessToken: string; user: PublicUser }> {
    const result = await this.sessions.login(dto);
    this.refreshCookie.set(reply, result.refreshToken);
    return { accessToken: result.accessToken, user: result.user };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<{ accessToken: string }> {
    const rawRefreshToken = request.cookies[REFRESH_COOKIE_NAME];
    if (!rawRefreshToken) {
      throw new UnauthorizedException('Missing refresh token');
    }
    const result: RefreshResult = await this.sessions.refresh(rawRefreshToken);
    this.refreshCookie.set(reply, result.refreshToken);
    return { accessToken: result.accessToken };
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<void> {
    await this.sessions.logout(request.cookies[REFRESH_COOKIE_NAME]);
    this.refreshCookie.clear(reply);
  }

  @Get('me')
  @UseGuards(AccessTokenGuard)
  me(@CurrentIdentity() identity: AuthenticatedIdentity): Promise<PublicUser> {
    return this.sessions.me(identity.userId);
  }
}
