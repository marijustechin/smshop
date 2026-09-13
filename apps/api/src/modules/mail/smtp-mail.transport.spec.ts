import type { Transporter } from 'nodemailer';
import { describe, expect, it, vi } from 'vitest';
import type { SmtpConfig } from './mail.config.js';
import { MailNotConfiguredError, MailSendError } from './mail.transport.js';
import { SmtpMailTransport } from './smtp-mail.transport.js';

const smtp: SmtpConfig = {
  host: 'smtp.example.com',
  port: 465,
  secure: true,
  user: 'smtp-user',
  password: 'super-secret-password',
  from: 'Šokolado meistrai <noreply@example.com>',
};

function fakeTransporter(sendMail: ReturnType<typeof vi.fn>): Transporter {
  return { sendMail } as unknown as Transporter;
}

describe('SmtpMailTransport', () => {
  it('sends using the configured sender and message payload', async () => {
    const sendMail = vi.fn().mockResolvedValue({ messageId: '1' });
    const transport = new SmtpMailTransport(smtp, fakeTransporter(sendMail));

    await transport.send({
      to: 'recipient@example.com',
      subject: 'Subject',
      text: 'Plain',
      html: '<p>Html</p>',
    });

    expect(sendMail).toHaveBeenCalledExactlyOnceWith({
      from: smtp.from,
      to: 'recipient@example.com',
      subject: 'Subject',
      text: 'Plain',
      html: '<p>Html</p>',
    });
  });

  it('omits html when not provided', async () => {
    const sendMail = vi.fn().mockResolvedValue({});
    const transport = new SmtpMailTransport(smtp, fakeTransporter(sendMail));

    await transport.send({ to: 'recipient@example.com', subject: 'S', text: 'T' });

    expect(sendMail).toHaveBeenCalledExactlyOnceWith({
      from: smtp.from,
      to: 'recipient@example.com',
      subject: 'S',
      text: 'T',
    });
  });

  it('wraps transport failures in a sanitized error without secrets', async () => {
    const sendMail = vi
      .fn()
      .mockRejectedValue(new Error(`535 auth failed for user ${smtp.user} with ${smtp.password}`));
    const transport = new SmtpMailTransport(smtp, fakeTransporter(sendMail));

    try {
      await transport.send({ to: 'recipient@example.com', subject: 'S', text: 'T' });
      throw new Error('expected send to reject');
    } catch (error) {
      expect(error).toBeInstanceOf(MailSendError);
      const message = (error as Error).message;
      expect(message).toBe('Failed to send email');
      expect(message).not.toContain(smtp.password);
      expect(message).not.toContain(smtp.user);
    }
  });

  it('throws MailNotConfiguredError when mail is disabled', async () => {
    const transport = new SmtpMailTransport(null, null);

    await expect(
      transport.send({ to: 'recipient@example.com', subject: 'S', text: 'T' }),
    ).rejects.toBeInstanceOf(MailNotConfiguredError);
  });
});
