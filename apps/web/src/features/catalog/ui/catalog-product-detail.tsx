'use client';

import * as React from 'react';
import Link from 'next/link';
import { ApiError } from '@/shared/api/client';
import { Alert } from '@/shared/ui/alert';
import { Button, buttonVariants } from '@/shared/ui/button';
import { Container } from '@/shared/ui/container';
import { resolveMediaUrl } from '@/shared/config/api';
import { getCatalogProduct } from '../api/catalog-api';
import type { PublicCatalogProductDetail } from '../model/types';
import { RatingBadge, TagChips } from './catalog-badges';

type Status = 'loading' | 'ready' | 'error' | 'notFound';

/**
 * Public catalogue product page (`/tortai/[slug]`). Informational only: no price,
 * stock, cart, checkout or order CTA.
 */
export function CatalogProductDetail({ slug }: { slug: string }) {
  const [product, setProduct] = React.useState<PublicCatalogProductDetail | null>(null);
  const [status, setStatus] = React.useState<Status>('loading');
  const [reloadToken, setReloadToken] = React.useState(0);

  React.useEffect(() => {
    const controller = new AbortController();
    getCatalogProduct(slug, controller.signal)
      .then((result) => {
        setProduct(result);
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

  // Client-side document metadata from the actual product data. Server-side
  // metadata cannot include the product (the public API is same-origin and the
  // frontend has no server-side API base by design).
  React.useEffect(() => {
    if (!product) {
      return;
    }
    document.title = `${product.name} — Šokolado meistrai`;
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'description');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', product.description.replace(/\s+/g, ' ').trim().slice(0, 160));
  }, [product]);

  const retry = () => {
    setStatus('loading');
    setReloadToken((token) => token + 1);
  };

  const breadcrumb = (
    <nav aria-label="Naršymas" className="text-sm text-text-muted">
      <Link href="/tortai" className="font-medium text-primary hover:underline">
        Tortai
      </Link>
      <span className="mx-2" aria-hidden="true">
        /
      </span>
      <span>{product?.name ?? 'Produktas'}</span>
    </nav>
  );

  if (status === 'loading') {
    return (
      <Container className="py-16">
        <p className="text-sm text-text-muted">Kraunama…</p>
      </Container>
    );
  }

  if (status === 'notFound') {
    return (
      <Container className="space-y-4 py-16">
        {breadcrumb}
        <Alert variant="info">Produktas nerastas.</Alert>
        <Link href="/tortai" className={buttonVariants({ variant: 'outline' })}>
          Grįžti į Tortai
        </Link>
      </Container>
    );
  }

  if (status === 'error' || !product) {
    return (
      <Container className="space-y-4 py-16">
        {breadcrumb}
        <Alert variant="error">Nepavyko įkelti produkto. Bandykite dar kartą.</Alert>
        <Button variant="outline" onClick={retry}>
          Bandyti dar kartą
        </Button>
      </Container>
    );
  }

  const paragraphs = product.description
    .split(/\n+/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0);

  return (
    <Container className="py-8 sm:py-12">
      {breadcrumb}

      <div className="mt-6 grid gap-8 lg:grid-cols-2 lg:items-start">
        <div className="aspect-[4/3] overflow-hidden rounded-lg border border-border bg-surface">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={resolveMediaUrl(product.primaryImageUrl)}
            alt={product.name}
            className="h-full w-full object-cover"
          />
        </div>

        <div>
          <p className="text-xs font-medium tracking-wide text-text-muted uppercase">
            <Link href="/tortai" className="hover:underline">
              {product.category.name}
            </Link>
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-primary sm:text-4xl">
            {product.name}
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <RatingBadge rating={product.rating} />
            <TagChips tags={product.tags} />
          </div>
          <div className="mt-5 space-y-3 text-text-muted">
            {paragraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
        </div>
      </div>
    </Container>
  );
}
