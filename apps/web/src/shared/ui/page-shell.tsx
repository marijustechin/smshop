import Link from 'next/link';
import { Card } from '@/shared/ui/card';

/** Centered card layout shared by all authentication pages. */
export function PageShell({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <Link href="/" className="text-lg font-semibold tracking-wide text-chocolate">
            Šokolado meistrai
          </Link>
        </div>
        <Card>
          <header className="mb-5 space-y-1">
            <h1 className="text-xl font-semibold text-chocolate">{title}</h1>
            {description ? <p className="text-sm text-muted">{description}</p> : null}
          </header>
          {children}
        </Card>
        {footer ? <div className="mt-5 text-center text-sm text-muted">{footer}</div> : null}
      </div>
    </main>
  );
}
