import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MailService } from './mail.service.js';
import { MAIL_TRANSPORT, type MailTransport } from './mail.transport.js';
import { readSmtpConfig, SMTP_CONFIG, type SmtpConfig } from './mail.config.js';
import {
  createSmtpTransporter,
  MAIL_TRANSPORTER,
  SmtpMailTransport,
} from './smtp-mail.transport.js';

@Module({
  providers: [
    {
      provide: SMTP_CONFIG,
      useFactory: (config: ConfigService): SmtpConfig | null => readSmtpConfig(config),
      inject: [ConfigService],
    },
    {
      provide: MAIL_TRANSPORTER,
      useFactory: (smtp: SmtpConfig | null) => (smtp ? createSmtpTransporter(smtp) : null),
      inject: [SMTP_CONFIG],
    },
    {
      provide: MAIL_TRANSPORT,
      useFactory: (
        smtp: SmtpConfig | null,
        transporter: ReturnType<typeof createSmtpTransporter> | null,
      ) => new SmtpMailTransport(smtp, transporter) as MailTransport,
      inject: [SMTP_CONFIG, MAIL_TRANSPORTER],
    },
    MailService,
  ],
  exports: [MailService],
})
export class MailModule {}
