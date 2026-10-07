'use client';

import * as React from 'react';
import Link from 'next/link';
import { ApiError } from '@/shared/api/client';
import { Alert } from '@/shared/ui/alert';
import { Button } from '@/shared/ui/button';
import { Container } from '@/shared/ui/container';
import { resolveMediaUrl } from '@/shared/config/api';
import { getCatalogCategory } from '../api/catalog-api';
import type { PublicCatalogCategory } from '../model/types';
import { RatingBadge, TagChips } from './catalog-badges';

type Status = 'loading' | 'ready' | 'error' | 'notFound';

/**
 * Public informational category page (`/tortai`). Shows only published catalogue
 * products; no price, stock, cart or rating elements.
 */
export function CatalogCategory({ slug, intro }: { slug: string; intro: string }) {
  const [data, setData] = React.useState<PublicCatalogCategory | null>(null);
  const [status, setStatus] = React.useState<Status>('loading');
  const [reloadToken, setReloadToken] = React.useState(0);

  React.useEffect(() => {
    const controller = new AbortController();
    getCatalogCategory(slug, controller.signal)
      .then((result) => {
        setData(result);
        setStatus('ready');
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          return;
        }
        setStatus(error instanceof ApiError && error.status === 404 ? 'notFound' : 'error');
      });
    return () => controller.abort();
  }, [slug, reloadToken]);

  const retry = () => {
    setStatus('loading');
    setReloadToken((token) => token + 1);
  };

  if (status === 'loading') {
    return (
      <Container className="py-16">
        <p className="text-sm text-text-muted">Kraunama…</p>
      </Container>
    );
  }

  if (status === 'notFound') {
    return (
      <Container className="py-16">
        <Alert variant="info">Kategorija nerasta.</Alert>
        <p className="mt-4 text-sm">
          <Link href="/" className="font-medium text-primary hover:underline">
            Grįžti į pradžią
          </Link>
        </p>
      </Container>
    );
  }

  if (status === 'error' || !data) {
    return (
      <Container className="space-y-4 py-16">
        <Alert variant="error">Nepavyko įkelti kategorijos. Bandykite dar kartą.</Alert>
        <Button variant="outline" onClick={retry}>
          Bandyti dar kartą
        </Button>
      </Container>
    );
  }

  return (
    <Container width="wide" className="py-10 sm:py-14">
      <header className="max-w-2xl">
        <h1 className="text-3xl font-semibold tracking-tight text-primary sm:text-4xl">
          {data.category.name}
        </h1>
        <p className="mt-3 text-text-muted">{intro}</p>
      </header>

      {data.products.length === 0 ? (
        <p className="mt-10 text-text-muted">Šiuo metu produktų nėra.</p>
      ) : (
        <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {data.products.map((product) => (
            <li key={product.slug}>
              <Link
                href={`/tortai/${product.slug}`}
                className="group block rounded-lg focus-visible:outline-focus"
              >
                <div className="aspect-[4/3] overflow-hidden rounded-lg border border-border bg-surface">
                  {/* Arbitrary legacy external URLs / API-origin media cannot use
                      next/image without per-domain config. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={resolveMediaUrl(product.primaryImageUrl)}
                    alt={product.name}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                  />
                </div>
                <div className="mt-3 flex items-start justify-between gap-2">
                  <h2 className="text-lg font-semibold text-primary group-hover:underline">
                    {product.name}
                  </h2>
                  <RatingBadge rating={product.rating} />
                </div>
                <TagChips tags={product.tags} className="mt-2" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Container>
  );
}
