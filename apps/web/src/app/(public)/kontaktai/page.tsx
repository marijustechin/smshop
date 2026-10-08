import type { Metadata } from 'next';
import { Container, Section } from '@/shared/ui/container';
import { cn } from '@/shared/lib/cn';
import { COMPANY, CONTACT, mailtoHref, telHref, type Store } from '@/shared/config/contact';

export const metadata: Metadata = {
  title: 'Kontaktai — Šokolado meistrai',
  description:
    'Šokolado meistrai: administracijos, užsakymų ir e-parduotuvės kontaktai bei firminės parduotuvės Vilniuje ir Kaune.',
  alternates: { canonical: '/kontaktai' },
};

const linkClass =
  'rounded-sm text-primary underline-offset-2 transition-colors hover:text-primary-strong hover:underline focus-visible:outline-focus';

const STORES_HEADING_ID = 'pardotuves';

function mapsUrl(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

function StatusBadge({ status }: { status: Store['status'] }) {
  if (status === 'open') {
    return null;
  }
  const label = status === 'temporarily-closed' ? 'Laikinai uždaryta' : 'Uždaryta';
  const tone =
    status === 'temporarily-closed'
      ? 'bg-warning-surface text-warning border-warning-border'
      : 'bg-danger-surface text-danger border-danger-border';
  return (
    <span className={cn('shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium', tone)}>
      {label}
    </span>
  );
}

function StoreItem({ store }: { store: Store }) {
  return (
    <li className="rounded-lg border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="font-medium text-primary">{store.name}</p>
        <StatusBadge status={store.status} />
      </div>
      <p className="mt-1 text-sm text-text-muted">{store.hours}</p>
      {store.status === 'open' ? (
        <a
          href={mapsUrl(store.address)}
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
 * Public contact page (SITE-001). Contact values come from
 * `@/shared/config/contact`; hours are quoted as published by the source without
 * inferring which weekdays they apply to.
 */
export default function KontaktaiPage() {
  const stores = CONTACT.stores;
  const vilnius = stores.filter((store) => store.city === 'Vilnius');
  const kaunas = stores.filter((store) => store.city === 'Kaunas');

  return (
    <Section>
      <Container className="space-y-10">
        <header className="max-w-2xl space-y-3">
          <h1 className="text-3xl font-semibold text-primary">Kontaktai</h1>
          <p className="text-text-muted">
            Turite klausimą apie užsakymą, tortą ar dovanas? Susisiekite žemiau nurodytais
            kontaktais — atsakysime nurodytomis darbo valandomis.
          </p>
        </header>

        <section aria-label="Kontaktų grupės">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {CONTACT.channels.map((channel) => (
              <div key={channel.id} className="rounded-lg border border-border bg-surface p-5">
                <h2 className="font-semibold text-primary">{channel.title}</h2>
                <p className="mt-1 text-sm text-text-muted">{channel.hours}</p>
                <p className="mt-3">
                  <a href={telHref(channel.phones[0])} className={linkClass}>
                    {channel.phones[0]}
                  </a>
                </p>
                <p className="mt-1">
                  <a href={mailtoHref(channel.email)} className={cn(linkClass, 'break-all')}>
                    {channel.email}
                  </a>
                </p>
                {channel.id === 'administracija' ? (
                  <p className="mt-3 text-sm text-text-muted">{CONTACT.address}</p>
                ) : null}
              </div>
            ))}
          </div>
        </section>

        <section id={STORES_HEADING_ID} aria-label="Firminės parduotuvės" className="space-y-6">
          <h2 className="text-2xl font-semibold text-primary">Firminės parduotuvės</h2>
          <div className="space-y-6">
            <div>
              <h3 className="mb-3 text-lg font-medium text-primary">Vilniuje</h3>
              <ul className="grid gap-3 sm:grid-cols-2">
                {vilnius.map((store) => (
                  <StoreItem key={store.name} store={store} />
                ))}
              </ul>
            </div>
            <div>
              <h3 className="mb-3 text-lg font-medium text-primary">Kaune</h3>
              <ul className="grid gap-3 sm:grid-cols-2">
                {kaunas.map((store) => (
                  <StoreItem key={store.name} store={store} />
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section
          aria-label="Įmonės informacija"
          className="border-t border-border pt-6 text-sm text-text-muted"
        >
          <h2 className="mb-2 font-semibold text-primary">Įmonės informacija</h2>
          <p className="text-text">{COMPANY.legalName}</p>
          <p>Įmonės kodas {COMPANY.code}</p>
          <p>{CONTACT.address}</p>
        </section>
      </Container>
    </Section>
  );
}
