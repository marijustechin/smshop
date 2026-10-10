'use client';

import * as React from 'react';
import { Alert } from '@/shared/ui/alert';
import { Button } from '@/shared/ui/button';
import { Container, Section } from '@/shared/ui/container';
import { cn } from '@/shared/lib/cn';
import { COMPANY, mailtoHref, telHref } from '@/shared/config/contact';
import { usePublicContacts } from '../api/contacts-api';
import { formatWeeklyHours, mapSearchUrl } from '../model/hours';
import type { PublicStore } from '../model/types';
import { ContactForm } from './contact-form';

const linkClass =
  'rounded-sm text-primary underline-offset-2 transition-colors hover:text-primary-strong hover:underline focus-visible:outline-focus';

function StoreItem({ store }: { store: PublicStore }) {
  const closed = store.status === 'TEMPORARILY_CLOSED';
  return (
    <li className="rounded-lg border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="font-medium text-primary">{store.name}</p>
        {closed ? (
          <span className="shrink-0 rounded-full border border-warning-border bg-warning-surface px-2 py-0.5 text-xs font-medium text-warning">
            Laikinai uždaryta
          </span>
        ) : null}
      </div>
      <p className="mt-1 text-sm text-text-muted">
        {closed
          ? (store.notice ?? 'Laikinai uždaryta')
          : formatWeeklyHours(store.hours) || 'Darbo laikas nenurodytas'}
      </p>
      {store.phone ? (
        <p className="mt-1 text-sm">
          <a href={telHref(store.phone)} className={linkClass}>
            {store.phone}
          </a>
        </p>
      ) : null}
      {store.email ? (
        <p className="mt-1 text-sm">
          <a href={mailtoHref(store.email)} className={cn(linkClass, 'break-all')}>
            {store.email}
          </a>
        </p>
      ) : null}
      {!closed ? (
        <a
          href={mapSearchUrl(store.address)}
          target="_blank"
          rel="noreferrer"
          className={cn(linkClass, 'mt-2 inline-block text-sm')}
        >
          Rodyti žemėlapyje
        </a>
      ) : null}
    </li>
  );
}

/**
 * Public contact page (SITE-001; data SITE-003; form SITE-004). Reads
 * administrator-managed contact groups and stores from the API at runtime and
 * exposes the contact form before the store list. It never displays fabricated
 * information while loading or on failure.
 */
export function ContactsContent() {
  const { status, data, retry } = usePublicContacts();
  const administration = data?.groups.find((group) => group.key === 'administracija');
  const empty = data ? data.groups.length === 0 && data.cities.length === 0 : false;

  return (
    <Section>
      <Container className="space-y-10">
        <header className="max-w-2xl space-y-3">
          <h1 className="text-3xl font-semibold text-primary">Kontaktai</h1>
          <p className="text-text-muted">
            Turite klausimą apie užsakymą, tortą ar dovanas? Parašykite mums arba susisiekite žemiau
            nurodytais kontaktais — atsakysime nurodytomis darbo valandomis.
          </p>
        </header>

        <ContactForm />

        {status === 'loading' ? <p className="text-sm text-text-muted">Kraunama…</p> : null}

        {status === 'error' ? (
          <div className="space-y-4">
            <Alert variant="error">Nepavyko įkelti kontaktų. Bandykite dar kartą.</Alert>
            <Button variant="outline" size="sm" onClick={retry}>
              Bandyti dar kartą
            </Button>
          </div>
        ) : null}

        {status === 'ready' && data ? (
          empty ? (
            <Alert variant="info">Kontaktai netrukus bus paskelbti.</Alert>
          ) : (
            <>
              {data.groups.length > 0 ? (
                <section aria-label="Kontaktų grupės">
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {data.groups.map((group) => (
                      <div
                        key={group.key}
                        className="rounded-lg border border-border bg-surface p-5"
                      >
                        <h2 className="font-semibold text-primary">{group.title}</h2>
                        <p className="mt-1 text-sm text-text-muted">{group.hours}</p>
                        <p className="mt-3">
                          <a href={telHref(group.phone)} className={linkClass}>
                            {group.phone}
                          </a>
                        </p>
                        <p className="mt-1">
                          <a href={mailtoHref(group.email)} className={cn(linkClass, 'break-all')}>
                            {group.email}
                          </a>
                        </p>
                        {group.address ? (
                          <p className="mt-3 text-sm text-text-muted">{group.address}</p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}

              {data.cities.length > 0 ? (
                <section id="pardotuves" aria-label="Firminės parduotuvės" className="space-y-6">
                  <h2 className="text-2xl font-semibold text-primary">Firminės parduotuvės</h2>
                  <div className="space-y-6">
                    {data.cities.map((city) => (
                      <div key={city.name}>
                        <h3 className="mb-3 text-lg font-medium text-primary">{city.name}</h3>
                        <ul className="grid gap-3 sm:grid-cols-2">
                          {city.stores.map((store) => (
                            <StoreItem key={`${city.name}:${store.name}`} store={store} />
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}
            </>
          )
        ) : null}

        <section
          aria-label="Įmonės informacija"
          className="border-t border-border pt-6 text-sm text-text-muted"
        >
          <h2 className="mb-2 font-semibold text-primary">Įmonės informacija</h2>
          <p className="text-text">{COMPANY.legalName}</p>
          <p>Įmonės kodas {COMPANY.code}</p>
          {administration?.address ? <p>{administration.address}</p> : null}
        </section>
      </Container>
    </Section>
  );
}
