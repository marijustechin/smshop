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
import { RegisterDto } from './dto/register.dto.js';
import { ResendVerificationDto } from './dto/resend-verification.dto.js';
import { VerifyEmailDto } from './dto/verify-email.dto.js';
import { LoginDto } from './dto/login.dto.js';
import {
  AuthSessionService,
  type PublicUser,
  type RefreshResult,
} from './session/auth-session.service.js';
import { AccessTokenGuard } from './session/access-token.guard.js';
import type { AuthenticatedIdentity } from './session/access-token.service.js';
import { CurrentIdentity } from './session/current-identity.decorator.js';
import { REFRESH_COOKIE_NAME, RefreshCookieService } from './session/refresh-cookie.service.js';

const GENERIC_RESEND_MESSAGE = 'If an eligible account exists, a verification email will be sent.';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly emailVerification: EmailVerificationService,
    private readonly sessions: AuthSessionService,
    private readonly refreshCookie: RefreshCookieService,
  ) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  register(@Body() dto: RegisterDto): Promise<RegisteredUser> {
    return this.authService.register(dto);
  }

  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  verifyEmail(@Body() dto: VerifyEmailDto): Promise<{ verified: true }> {
    return this.emailVerification.verify(dto.token);
  }

  @Post('resend-verification')
  @HttpCode(HttpStatus.ACCEPTED)
  async resendVerification(@Body() dto: ResendVerificationDto): Promise<{ message: string }> {
    await this.emailVerification.resend(dto.email);
    return { message: GENERIC_RESEND_MESSAGE };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
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
