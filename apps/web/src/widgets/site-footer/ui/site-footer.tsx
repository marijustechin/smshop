import Image from 'next/image';
import Link from 'next/link';
import { Container } from '@/shared/ui/container';
import { cn } from '@/shared/lib/cn';
import { COMPANY, CONTACT, mailtoHref, telHref } from '@/shared/config/contact';

const linkClass =
  'rounded-sm text-primary underline-offset-2 transition-colors hover:text-primary-strong hover:underline focus-visible:outline-focus';

/**
 * Shared public footer (SITE-001). Rendered by the public layout so it appears on
 * every visitor-facing page, including the authentication pages; the
 * administration area is outside that layout and keeps its own shell.
 *
 * All values come from `@/shared/config/contact` so the footer and the contact
 * page cannot drift.
 */
export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-auto border-t border-border bg-surface-cream">
      <Container className="py-8 sm:py-10">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-3">
            <Link
              href="/"
              aria-label="Šokolado meistrai — pradžia"
              className="inline-flex rounded-md focus-visible:outline-focus"
            >
              <Image
                src="/branding/sokolado-meistrai-logo-chocolate.webp"
                alt="Šokolado meistrai"
                width={512}
                height={323}
                className="h-10 w-auto"
              />
            </Link>
            <p className="max-w-xs text-sm text-text-muted">
              Nuo {COMPANY.foundedYear} metų gaminame konditerijos gaminius, šokoladines dovanas ir
              tortus.
            </p>
          </div>

          <nav aria-label="Poraštės navigacija" className="text-sm">
            <h2 className="mb-2 font-semibold text-primary">Navigacija</h2>
            <ul className="space-y-1">
              <li>
                <Link href="/tortai" className={linkClass}>
                  Tortai
                </Link>
              </li>
              <li>
                <Link href="/kontaktai" className={linkClass}>
                  Kontaktai
                </Link>
              </li>
              <li>
                <Link href="/kontaktai#pardotuves" className={linkClass}>
                  Parduotuvės
                </Link>
              </li>
            </ul>
          </nav>

          <div className="text-sm">
            <h2 className="mb-2 font-semibold text-primary">Kontaktai</h2>
            <p className="space-y-1">
              <a href={telHref(CONTACT.generalPhone)} className={cn(linkClass, 'inline-block')}>
                {CONTACT.generalPhone}
              </a>
            </p>
            <p className="mt-1">
              <a href={mailtoHref(CONTACT.generalEmail)} className={cn(linkClass, 'break-all')}>
                {CONTACT.generalEmail}
              </a>
            </p>
          </div>

          <div className="text-sm text-text-muted">
            <h2 className="mb-2 font-semibold text-primary">Įmonė</h2>
            <p className="text-text">{COMPANY.legalName}</p>
            <p>Įmonės kodas {COMPANY.code}</p>
            <p className="mt-1">© {year} Šokolado meistrai</p>
          </div>
        </div>
      </Container>
    </footer>
  );
}
