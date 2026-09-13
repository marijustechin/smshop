import { Inject, Injectable } from '@nestjs/common';
import { MAIL_TRANSPORT, type MailMessage, type MailTransport } from './mail.transport.js';

/**
 * Application-facing email API. Auth and other modules send through this
 * service; SMTP/provider concepts stay inside the transport implementation.
 */
@Injectable()
export class MailService {
  constructor(@Inject(MAIL_TRANSPORT) private readonly transport: MailTransport) {}

  async send(message: MailMessage): Promise<void> {
    await this.transport.send(message);
  }
}
