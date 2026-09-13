import { describe, expect, it, vi } from 'vitest';
import { MailService } from './mail.service.js';
import type { MailMessage, MailTransport } from './mail.transport.js';

describe('MailService', () => {
  it('delegates to the injected transport', async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const transport: MailTransport = { send };
    const service = new MailService(transport);
    const message: MailMessage = {
      to: 'recipient@example.com',
      subject: 'Hello',
      text: 'Plain body',
      html: '<p>HTML body</p>',
    };

    await service.send(message);

    expect(send).toHaveBeenCalledExactlyOnceWith(message);
  });

  it('propagates transport errors to the caller', async () => {
    const transport: MailTransport = {
      send: vi.fn().mockRejectedValue(new Error('boom')),
    };
    const service = new MailService(transport);

    await expect(service.send({ to: 'a@example.com', subject: 's', text: 't' })).rejects.toThrow(
      'boom',
    );
  });
});
