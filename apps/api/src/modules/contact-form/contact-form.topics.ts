/**
 * Fixed contact-form topics. The wire keys are stable and map to the
 * administrator-managed contact groups (SITE-003); the recipient is resolved
 * from the database at submission time and is never supplied by the client.
 */
export const CONTACT_TOPICS = ['general', 'order', 'shop'] as const;

export type ContactTopic = (typeof CONTACT_TOPICS)[number];

/** Topic → persisted `ContactGroup.key` (SITE-003 seed keys). */
export const TOPIC_TO_GROUP_KEY: Record<ContactTopic, string> = {
  general: 'administracija',
  order: 'uzsakymai',
  shop: 'e-parduotuve',
};

/** Lithuanian topic labels shown in the form and used in the email subject. */
export const TOPIC_LABELS: Record<ContactTopic, string> = {
  general: 'Bendras klausimas',
  order: 'Užsakymas',
  shop: 'El. parduotuvė',
};
