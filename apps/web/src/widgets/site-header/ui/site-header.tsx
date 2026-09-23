'use client';

import * as React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { useAuth } from '@/features/auth';
import { Container } from '@/shared/ui/container';
import { cn } from '@/shared/lib/cn';
import { useMediaQuery } from '@/shared/lib/use-media-query';
import { UserMenu } from './user-menu';

const MENU_ID = 'site-menu';
const FOCUSABLE =
  'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"]), input, select, textarea';

/**
 * Project mobile/desktop boundary for the header. Below it the textual
 * `Administravimas` action is never rendered (admin stays reachable through the
 * account dropdown and the drawer); at or above it there is comfortable room.
 */
const DESKTOP_QUERY = '(min-width: 768px)';

interface DrawerLink {
  href: string;
  label: string;
}

/**
 * Public storefront header with an always-available hamburger that opens a
 * full-height navigation drawer. The drawer and the right-hand actions are
 * session-aware and share the single `useAuth()` state:
 *   - guest: `Prisijungti` action; drawer: Pagrindinis / Prisijungti / Registruotis
 *   - user|editor: account dropdown; drawer: Pagrindinis / Mano paskyra / Atsijungti
 *   - admin: account dropdown + desktop `Administravimas` action; drawer adds Administravimas
 *
 * The layout uses equal flexible side tracks around an auto-sized, centered
 * logo, so left/right controls can never push the logo out of place.
 */
export function SiteHeader() {
  const { status, user, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const isDesktop = useMediaQuery(DESKTOP_QUERY);
  const [open, setOpen] = React.useState(false);
  const closeButtonRef = React.useRef<HTMLButtonElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);

  const close = React.useCallback(() => setOpen(false), []);

  React.useEffect(() => {
    if (!open) {
      return;
    }
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
        return;
      }
      if (event.key !== 'Tab') {
        return;
      }
      const panel = panelRef.current;
      if (!panel) {
        return;
      }
      const focusables = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (element) => element.offsetParent !== null || element === document.activeElement,
      );
      if (focusables.length === 0) {
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.();
    };
  }, [open, close]);

  const isAuthenticated = status === 'authenticated' && user !== null;
  const isAdmin = user?.role === 'admin';

  const isActive = React.useCallback(
    (href: string) => {
      if (!pathname) {
        return false;
      }
      return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
    },
    [pathname],
  );

  const drawerLinks = React.useMemo<DrawerLink[]>(() => {
    if (!isAuthenticated || !user) {
      return [
        { href: '/', label: 'Pagrindinis' },
        { href: '/prisijungti', label: 'Prisijungti' },
        { href: '/registracija', label: 'Registruotis' },
      ];
    }
    const links: DrawerLink[] = [{ href: '/', label: 'Pagrindinis' }];
    if (user.role === 'admin') {
      links.push({ href: '/administravimas', label: 'Administravimas' });
    }
    links.push({ href: '/paskyra', label: 'Mano paskyra' });
    return links;
  }, [isAuthenticated, user]);

  const onLogout = React.useCallback(async () => {
    await logout();
    router.replace('/');
  }, [logout, router]);

  const onDrawerLogout = () => {
    close();
    void onLogout();
  };

  const actionClass =
    'inline-flex h-9 items-center rounded-md px-3 text-sm font-medium text-primary transition-colors hover:bg-white/60 focus-visible:outline-focus';

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface-cream">
      <Container className="grid h-16 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
        <button
          type="button"
          aria-label="Atidaryti meniu"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={MENU_ID}
          onClick={() => setOpen(true)}
          className="inline-flex h-10 w-10 items-center justify-center justify-self-start rounded-md text-primary transition-colors hover:bg-white/60 focus-visible:outline-focus"
        >
          <Menu aria-hidden="true" className="h-6 w-6" />
        </button>

        <Link
          href="/"
          aria-label="Šokolado meistrai — pradžia"
          className="inline-flex shrink-0 items-center justify-self-center rounded-md focus-visible:outline-focus"
        >
          <Image
            src="/branding/sokolado-meistrai-logo-chocolate.webp"
            alt="Šokolado meistrai"
            width={512}
            height={323}
            className="h-10 w-auto sm:h-11"
          />
        </Link>

        <div className="flex min-w-0 items-center justify-self-end gap-1">
          {isAuthenticated && user ? (
            <>
              {isAdmin && isDesktop ? (
                <Link href="/administravimas" className={actionClass}>
                  Administravimas
                </Link>
              ) : null}
              <UserMenu showAdminItem={isAdmin && !isDesktop} onLogout={onLogout} />
            </>
          ) : status === 'unauthenticated' ? (
            <Link href="/prisijungti" className={actionClass}>
              Prisijungti
            </Link>
          ) : null}
        </div>
      </Container>

      {open ? (
        <div
          className="fixed inset-0 z-50 animate-overlay-in bg-ink/40"
          onClick={close}
          data-testid="site-menu-overlay"
        >
          <div
            id={MENU_ID}
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Meniu"
            onClick={(event) => event.stopPropagation()}
            className="flex h-full w-full max-w-sm animate-panel-in flex-col bg-primary text-on-primary shadow-md"
          >
            <div className="flex items-center justify-between px-5 py-4">
              <Image
                src="/branding/sokolado-meistrai-logo-creme.webp"
                alt="Šokolado meistrai"
                width={512}
                height={323}
                className="h-10 w-auto"
              />
              <button
                ref={closeButtonRef}
                type="button"
                aria-label="Uždaryti meniu"
                onClick={close}
                className="inline-flex h-10 w-10 items-center justify-center rounded-md text-on-primary transition-colors hover:bg-white/10 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                <X aria-hidden="true" className="h-6 w-6" />
              </button>
            </div>

            <nav
              aria-label="Pagrindinė navigacija"
              className="flex-1 border-t border-white/15 px-3 py-3"
            >
              <ul className="space-y-1">
                {drawerLinks.map((item) => {
                  const active = isActive(item.href);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={close}
                        aria-current={active ? 'page' : undefined}
                        className={cn(
                          'relative flex min-h-12 items-center rounded-md px-4 text-base font-medium transition-colors focus-visible:outline-white',
                          active
                            ? 'bg-white/10 text-on-primary'
                            : 'text-on-primary/80 hover:bg-white/10 hover:text-on-primary',
                        )}
                      >
                        {active ? (
                          <span
                            aria-hidden="true"
                            data-testid="drawer-active-accent"
                            className="absolute top-1/2 left-0 h-5 w-1 -translate-y-1/2 rounded-full bg-caramel"
                          />
                        ) : null}
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
                {isAuthenticated ? (
                  <li>
                    <button
                      type="button"
                      onClick={onDrawerLogout}
                      className="relative flex min-h-12 w-full items-center rounded-md px-4 text-left text-base font-medium text-on-primary/80 transition-colors hover:bg-white/10 hover:text-on-primary focus-visible:outline-white"
                    >
                      Atsijungti
                    </button>
                  </li>
                ) : null}
              </ul>
            </nav>

            <div className="px-5 py-5 text-xs text-white/70">
              Šokolado meistrai · rankų darbo šokoladas ir konditerija
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}
