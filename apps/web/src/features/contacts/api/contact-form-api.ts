import { apiRequest } from '@/shared/api/client';
import type { ContactTopic } from '../model/topics';

export interface ContactFormSubmission {
  topic: ContactTopic;
  email: string;
  message: string;
  name?: string;
  phone?: string;
  turnstileToken?: string | null;
}

/**
 * Submits the public contact form. The recipient is resolved server-side from
 * the administrator-managed contact groups; the client never sends one.
 */
export function submitContactForm(input: ContactFormSubmission): Promise<{ message: string }> {
  const { turnstileToken, ...body } = input;
  return apiRequest<{ message: string }>('/api/public/contact', {
    method: 'POST',
    body: turnstileToken ? { ...body, turnstileToken } : body,
  });
}
