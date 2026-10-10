/**
 * Contact-form topics (wire keys) and their Lithuanian labels. Kept in sync with
 * the API's fixed topic→contact-group mapping; the client never sends a
 * recipient address.
 */
export const CONTACT_TOPIC_VALUES = ['general', 'order', 'shop'] as const;

export type ContactTopic = (typeof CONTACT_TOPIC_VALUES)[number];

export const CONTACT_TOPIC_LABELS: Record<ContactTopic, string> = {
  general: 'Bendras klausimas',
  order: 'Užsakymas',
  shop: 'El. parduotuvė',
};
