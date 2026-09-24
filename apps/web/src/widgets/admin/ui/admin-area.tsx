'use client';

import * as React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { useAuth } from '@/features/auth';
import { Alert } from '@/shared/ui/alert';
import { Button } from '@/shared/ui/button';
import { cn } from '@/shared/lib/cn';
import { useMediaQuery } from '@/shared/lib/use-media-query';

const ADMIN_HOME = '/administravimas';
const NAV_MENU_ID = 'admin-nav';

/** Admin is desktop-first: below this width the sidebar becomes temporary. */
const DESKTOP_QUERY = '(min-width: 1024px)';

const NAV_ITEMS = [
  { href: '/administravimas', label: 'Suvestinė' },
  { href: '/administravimas/naudotojai', label: 'Naudotojai' },
] as const;

function isActive(pathname: string | null, href: string): boolean {
  if (!pathname) {
    return false;
  }
  if (href === ADMIN_HOME) {
    return pathname === ADMIN_HOME;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function pageTitle(pathname: string | null): string {
  return NAV_ITEMS.find((item) => isActive(pathname, item.href))?.label ?? 'Administravimas';
}

function AccessDenied({ email }: { email: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-lg border border-border bg-surface p-6 text-center shadow-sm">
        <h1 className="text-xl font-semibold text-primary">Neturite prieigos</h1>
        <p className="mt-2 text-sm text-text-muted">
          Ši sritis skirta tik administratoriams. Prisijungta kaip {email}.
        </p>
        <div className="mt-6 flex justify-center gap-3 text-sm">
          <Link href="/paskyra" className="font-medium text-primary hover:underline">
            Mano paskyra
          </Link>
          <Link href="/" className="font-medium text-primary hover:underline">
            Į parduotuvę
          </Link>
        </div>
      </div>
    </main>
  );
}

function AdminSidebar({
  email,
  pathname,
  onNavigate,
}: {
  email: string;
  pathname: string | null;
  onNavigate?: () => void;
}) {
  return (
    <div className="flex h-full flex-col bg-primary text-on-primary">
      <div className="px-5 py-5">
        <Image
          src="/branding/sokolado-meistrai-logo-creme.webp"
          alt="Šokolado meistrai"
          width={512}
          height={323}
          className="h-9 w-auto"
        />
      </div>

      <div className="px-5 pb-4">
        <p className="text-xs text-white/60">Administratorius</p>
        <p className="truncate text-sm font-medium text-on-primary">{email}</p>
      </div>

      <nav
        aria-label="Administravimo navigacija"
        className="flex-1 border-t border-white/15 px-3 py-3"
      >
        <ul className="space-y-1">
          {NAV_ITEMS.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'relative flex min-h-10 items-center rounded-md px-4 text-sm font-medium transition-colors focus-visible:outline-white',
                    active
                      ? 'bg-white/10 text-on-primary'
                      : 'text-white/75 hover:bg-white/10 hover:text-on-primary',
                  )}
                >
                  {active ? (
                    <span
                      aria-hidden="true"
                      data-testid="admin-nav-active-accent"
                      className="absolute top-1/2 left-0 h-5 w-1 -translate-y-1/2 rounded-full bg-caramel"
                    />
                  ) : null}
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-white/15 px-5 py-5">
        <Link
          href="/"
          className="text-sm text-white/75 transition-colors hover:text-on-primary focus-visible:outline-white"
        >
          Į parduotuvę
        </Link>
      </div>
    </div>
  );
}

/**
 * Access boundary and desktop-first administration shell. Guests are redirected
 * to login with a preserved `returnTo`; authenticated non-admins get an explicit
 * access-denied state. At desktop widths the dark sidebar is persistent; on
 * narrower screens it becomes a temporary overlay opened from the top bar. This
 * is UX only — the API re-checks the role on every admin request.
 */
export function AdminArea({ children }: { children: React.ReactNode }) {
  const { status, user, bootstrap } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const isDesktop = useMediaQuery(DESKTOP_QUERY);
  const [navOpen, setNavOpen] = React.useState(false);
  const [retrying, setRetrying] = React.useState(false);
  const closeButtonRef = React.useRef<HTMLButtonElement>(null);

  const showNav = navOpen && !isDesktop;

  React.useEffect(() => {
    if (status === 'unauthenticated') {
      const target = pathname && pathname.startsWith('/') ? pathname : ADMIN_HOME;
      router.replace(`/prisijungti?returnTo=${encodeURIComponent(target)}`);
    }
  }, [status, router, pathname]);

  React.useEffect(() => {
    if (!showNav) {
      return;
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setNavOpen(false);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [showNav]);

  const onRetry = async () => {
    setRetrying(true);
    try {
      await bootstrap();
    } finally {
      setRetrying(false);
    }
  };

  if (status === 'unknown') {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <p className="text-sm text-text-muted">Kraunama…</p>
      </main>
    );
  }

  if (status === 'error') {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-md space-y-4">
          <Alert variant="error">
            Nepavyko patikrinti prisijungimo būsenos. Tai gali būti laikinas ryšio sutrikimas.
          </Alert>
          <Button variant="outline" onClick={onRetry} disabled={retrying}>
            {retrying ? 'Bandoma…' : 'Bandyti dar kartą'}
          </Button>
        </div>
      </main>
    );
  }

  if (status === 'unauthenticated' || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <p className="text-sm text-text-muted">Kreipiamasi į prisijungimą…</p>
      </main>
    );
  }

  if (user.role !== 'admin') {
    return <AccessDenied email={user.email} />;
  }

  const title = pageTitle(pathname);

  return (
    <div className="min-h-screen bg-canvas">
      <div className={cn('min-h-screen', isDesktop && 'flex')}>
        {isDesktop ? (
          <aside className="sticky top-0 h-screen w-64 shrink-0">
            <AdminSidebar email={user.email} pathname={pathname} />
          </aside>
        ) : null}

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 border-b border-border bg-surface">
            <div className="flex items-center gap-3 px-4 py-3 sm:px-6">
              {!isDesktop ? (
                <button
                  type="button"
                  aria-label="Atidaryti administravimo meniu"
                  aria-haspopup="dialog"
                  aria-expanded={showNav}
                  aria-controls={NAV_MENU_ID}
                  onClick={() => setNavOpen(true)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md text-primary transition-colors hover:bg-surface-muted focus-visible:outline-focus"
                >
                  <Menu aria-hidden="true" className="h-5 w-5" />
                </button>
              ) : null}
              <h1 className="text-lg font-semibold text-primary">{title}</h1>
            </div>
          </header>

          <main className="w-full px-4 py-6 sm:px-6 lg:px-8">{children}</main>
        </div>
      </div>

      {showNav ? (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-ink/40"
            onClick={() => setNavOpen(false)}
            data-testid="admin-nav-overlay"
          />
          <div
            id={NAV_MENU_ID}
            role="dialog"
            aria-modal="true"
            aria-label="Administravimo meniu"
            className="absolute inset-y-0 left-0 w-72 max-w-[85%] animate-panel-in shadow-md"
          >
            <AdminSidebar
              email={user.email}
              pathname={pathname}
              onNavigate={() => setNavOpen(false)}
            />
            <button
              ref={closeButtonRef}
              type="button"
              aria-label="Uždaryti meniu"
              onClick={() => setNavOpen(false)}
              className="absolute top-4 right-3 inline-flex h-9 w-9 items-center justify-center rounded-md text-on-primary transition-colors hover:bg-white/10 focus-visible:outline-white"
            >
              <X aria-hidden="true" className="h-5 w-5" />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
