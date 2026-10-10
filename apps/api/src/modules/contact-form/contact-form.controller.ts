import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { RateLimit } from '../auth/security/rate-limit/rate-limit.decorator.js';
import { RateLimitGuard } from '../auth/security/rate-limit/rate-limit.guard.js';
import { TurnstileGuard } from '../auth/security/turnstile/turnstile.guard.js';
import { ContactFormService } from './contact-form.service.js';
import { SubmitContactFormDto } from './dto/contact-form.dto.js';

const TEN_MINUTES = 600_000;

/**
 * Public contact form. `RateLimitGuard` and `TurnstileGuard` run before the
 * request pipe and business logic, so a rate-limited or unverified request never
 * reaches mail. The recipient is resolved server-side from the contact groups.
 */
@Controller('public/contact')
export class ContactFormController {
  constructor(private readonly contactForm: ContactFormService) {}

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  @RateLimit({ name: 'contact-form', limit: 5, windowMs: TEN_MINUTES })
  @UseGuards(RateLimitGuard, TurnstileGuard)
  submit(@Body() dto: SubmitContactFormDto): Promise<{ message: string }> {
    return this.contactForm.submit(dto);
  }
}
