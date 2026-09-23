'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth';
import { Alert } from '@/shared/ui/alert';
import { Button } from '@/shared/ui/button';
import { cn } from '@/shared/lib/cn';

const ADMIN_HOME = '/administravimas/naudotojai';

const NAV_ITEMS = [{ href: '/administravimas/naudotojai', label: 'Naudotojai' }];

function AccessDenied({ email }: { email: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-lg border border-border bg-white p-6 text-center shadow-sm">
        <h1 className="text-xl font-semibold text-chocolate">Neturite prieigos</h1>
        <p className="mt-2 text-sm text-muted">
          Ši sritis skirta tik administratoriams. Prisijungta kaip {email}.
        </p>
        <div className="mt-6 flex justify-center gap-3 text-sm">
          <Link href="/paskyra" className="font-medium text-chocolate hover:underline">
            Mano paskyra
          </Link>
          <Link href="/" className="font-medium text-chocolate hover:underline">
            Į parduotuvę
          </Link>
        </div>
      </div>
    </main>
  );
}

/**
 * Client-side access boundary for the admin area. Guests are redirected to the
 * login page with a preserved `returnTo`; authenticated non-admins get an
 * explicit access-denied state. This is UX only — the API re-checks the role on
 * every admin request.
 */
export function AdminArea({ children }: { children: React.ReactNode }) {
  const { status, user, bootstrap } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [retrying, setRetrying] = React.useState(false);

  React.useEffect(() => {
    if (status === 'unauthenticated') {
      const target = pathname && pathname.startsWith('/') ? pathname : ADMIN_HOME;
      router.replace(`/prisijungti?returnTo=${encodeURIComponent(target)}`);
    }
  }, [status, router, pathname]);

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
        <p className="text-sm text-muted">Kraunama…</p>
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
        <p className="text-sm text-muted">Kreipiamasi į prisijungimą…</p>
      </main>
    );
  }

  if (user.role !== 'admin') {
    return <AccessDenied email={user.email} />;
  }

  return (
    <div className="min-h-screen bg-ivory">
      <header className="border-b border-border bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <Link
              href="/"
              className="flex items-center gap-2 text-sm font-semibold tracking-wide text-chocolate"
            >
              <span className="grid h-8 w-8 place-items-center rounded-full bg-chocolate text-xs text-ivory">
                ŠM
              </span>
              <span>
                Šokolado meistrai
                <span className="hidden sm:inline"> · Administravimas</span>
              </span>
            </Link>
            <nav aria-label="Administravimo navigacija">
              <ul className="flex items-center gap-1">
                {NAV_ITEMS.map((item) => {
                  const active =
                    pathname === item.href || (pathname?.startsWith(`${item.href}/`) ?? false);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={active ? 'page' : undefined}
                        className={cn(
                          'rounded-md px-3 py-1.5 text-sm font-medium',
                          active
                            ? 'bg-cream/60 text-chocolate'
                            : 'text-muted hover:bg-cream/40 hover:text-chocolate',
                        )}
                      >
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted">
            <span className="hidden max-w-[16rem] truncate sm:inline">{user.email}</span>
            <Link href="/paskyra" className="font-medium text-chocolate hover:underline">
              Paskyra
            </Link>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}
