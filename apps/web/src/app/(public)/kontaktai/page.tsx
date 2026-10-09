import type { Metadata } from 'next';
import { ContactsContent } from '@/features/contacts';

export const metadata: Metadata = {
  title: 'Kontaktai — Šokolado meistrai',
  description:
    'Šokolado meistrai: administracijos, užsakymų ir e-parduotuvės kontaktai bei firminės parduotuvės Vilniuje ir Kaune.',
  alternates: { canonical: '/kontaktai' },
};

/**
 * Public contact page shell. The contact groups and stores are administrator
 * managed and fetched at runtime (SITE-003) so edits are visible without a
 * redeploy; the static shell keeps the metadata and layout.
 */
export default function KontaktaiPage() {
  return <ContactsContent />;
}
