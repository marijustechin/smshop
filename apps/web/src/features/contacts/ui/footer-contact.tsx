'use client';

import { cn } from '@/shared/lib/cn';
import { mailtoHref, telHref } from '@/shared/config/contact';
import { usePublicContacts } from '../api/contacts-api';

const linkClass =
  'rounded-sm text-on-primary underline-offset-2 transition-colors hover:underline focus-visible:outline-on-primary';

/**
 * Footer contact values (chocolate surface). Uses the persisted administration
 * group so footer and contact page cannot drift. While loading or on failure it
 * renders a neutral label instead of fabricated contact data.
 */
export function FooterContact() {
  const { status, data } = usePublicContacts();
  const group =
    data?.groups.find((item) => item.key === 'administracija') ?? data?.groups[0] ?? null;

  if (status !== 'ready' || !group) {
    return <p className="text-sm text-on-primary/80">Kontaktai</p>;
  }

  return (
    <>
      <p>
        <a href={telHref(group.phone)} className={cn(linkClass, 'inline-block')}>
          {group.phone}
        </a>
      </p>
      <p className="mt-1">
        <a href={mailtoHref(group.email)} className={cn(linkClass, 'break-all')}>
          {group.email}
        </a>
      </p>
    </>
  );
}
