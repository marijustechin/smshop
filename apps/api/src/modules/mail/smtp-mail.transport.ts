import { createTransport, type Transporter } from 'nodemailer';
import type { SmtpConfig } from './mail.config.js';
import {
  MailNotConfiguredError,
  MailSendError,
  type MailMessage,
  type MailTransport,
} from './mail.transport.js';

export const MAIL_TRANSPORTER = Symbol('MAIL_TRANSPORTER');

/** Conservative connection timeouts so a send cannot hang indefinitely. */
export const SMTP_TIMEOUTS = {
  connectionTimeout: 10_000,
  greetingTimeout: 10_000,
  socketTimeout: 30_000,
} as const;

/** Builds a configured SMTP transporter. No connection is opened until send. */
export function createSmtpTransporter(smtp: SmtpConfig): Transporter {
  return createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: smtp.user && smtp.password ? { user: smtp.user, pass: smtp.password } : undefined,
    pool: false,
    ...SMTP_TIMEOUTS,
  });
}

/**
 * SMTP implementation of the mail boundary. Provider independent: every value
 * comes from configuration, so switching SMTP providers requires no code change.
 */
export class SmtpMailTransport implements MailTransport {
  constructor(
    private readonly smtp: SmtpConfig | null,
    private readonly transporter: Transporter | null,
  ) {}

  async send(message: MailMessage): Promise<void> {
    if (!this.smtp || !this.transporter) {
      throw new MailNotConfiguredError();
    }

    try {
      await this.transporter.sendMail({
        from: this.smtp.from,
        to: message.to,
        subject: message.subject,
        text: message.text,
        ...(message.html ? { html: message.html } : {}),
      });
    } catch (error) {
      // Never surface the underlying error (which may include SMTP/auth detail)
      // as the message; keep it only as the internal cause for server logs.
      throw new MailSendError({ cause: error });
    }
  }
}
