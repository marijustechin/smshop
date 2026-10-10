import { Module } from '@nestjs/common';
import { SecurityModule } from '../auth/security/security.module.js';
import { MailModule } from '../mail/mail.module.js';
import { ContactFormController } from './contact-form.controller.js';
import { ContactFormService } from './contact-form.service.js';

/**
 * Public contact form. Reuses the application mail transport and the existing
 * Turnstile/rate-limit security boundaries; `PrismaModule` is global.
 */
@Module({
  imports: [MailModule, SecurityModule],
  controllers: [ContactFormController],
  providers: [ContactFormService],
})
export class ContactFormModule {}
