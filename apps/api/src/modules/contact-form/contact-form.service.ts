import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { MailService } from '../mail/mail.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { SubmitContactFormDto } from './dto/contact-form.dto.js';
import {
  ContactRecipientUnavailableException,
  ContactSendFailedException,
} from './contact-form.exceptions.js';
import { TOPIC_LABELS, TOPIC_TO_GROUP_KEY, type ContactTopic } from './contact-form.topics.js';

const recipientEmailSchema = z.email();

/** Plain-text body: visitor input is content only, never mail headers. */
function buildBody(topic: ContactTopic, dto: SubmitContactFormDto): string {
  const name = dto.name?.trim();
  const phone = dto.phone?.trim();
  return [
    `Tema: ${TOPIC_LABELS[topic]}`,
    `El. paštas: ${dto.email}`,
    name ? `Vardas: ${name}` : null,
    phone ? `Telefonas: ${phone}` : null,
    '',
    'Žinutė:',
    dto.message,
  ]
    .filter((line): line is string => line !== null)
    .join('\n');
}

/**
 * Public contact form (SITE-004). Resolves the recipient from the persisted
 * contact groups at submission time (so administrator email edits take effect
 * without a redeploy), sends a plain-text email through the application mail
 * transport, and reports success only after the transport accepts it. Message
 * bodies, visitor addresses and Turnstile tokens are never logged or stored.
 */
@Injectable()
export class ContactFormService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  async submit(dto: SubmitContactFormDto): Promise<{ message: string }> {
    const topic = dto.topic as ContactTopic;
    const group = await this.prisma.contactGroup.findUnique({
      where: { key: TOPIC_TO_GROUP_KEY[topic] },
    });
    const recipient = group?.email?.trim() ?? '';
    if (!recipient || !recipientEmailSchema.safeParse(recipient).success) {
      throw new ContactRecipientUnavailableException();
    }

    try {
      await this.mail.send({
        to: recipient,
        replyTo: dto.email,
        subject: `Svetainės užklausa: ${TOPIC_LABELS[topic]}`,
        text: buildBody(topic, dto),
      });
    } catch {
      throw new ContactSendFailedException();
    }

    return { message: 'Ačiū! Jūsų žinutė išsiųsta.' };
  }
}
