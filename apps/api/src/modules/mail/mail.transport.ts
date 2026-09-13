/**
 * Provider-independent email boundary. The application depends on
 * `MailTransport`, never on a specific SMTP library or provider.
 */
export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface MailTransport {
  send(message: MailMessage): Promise<void>;
}

export const MAIL_TRANSPORT = Symbol('MAIL_TRANSPORT');

/** Raised when mail is used but no SMTP configuration was provided. */
export class MailNotConfiguredError extends Error {
  constructor() {
    super('Mail transport is not configured');
    this.name = 'MailNotConfiguredError';
  }
}

/** Sanitized wrapper for transport failures; never carries credentials. */
export class MailSendError extends Error {
  constructor(options?: { cause?: unknown }) {
    super('Failed to send email', options);
    this.name = 'MailSendError';
  }
}
