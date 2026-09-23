import { Card } from './card';

/**
 * Centered card layout shared by the authentication and account pages. The
 * brand logo lives in the public `SiteHeader`, so it is intentionally not
 * repeated here. The `flex-1` column centers the card in the space below the
 * header.
 */
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
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-10">
      <Card>
        <header className="mb-5 space-y-1">
          <h1 className="text-xl font-semibold text-primary">{title}</h1>
          {description ? <p className="text-sm text-text-muted">{description}</p> : null}
        </header>
        {children}
      </Card>
      {footer ? <div className="mt-5 text-center text-sm text-text-muted">{footer}</div> : null}
    </div>
  );
}
