import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CatalogProductDetail } from '@/features/catalog';

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  return {
    title: 'Tortas — Šokolado meistrai',
    alternates: { canonical: `/tortai/${slug}` },
  };
}

export default async function TortaiProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  // Malformed slugs are a framework 404; a valid-but-non-public slug resolves to
  // the API 404 and renders the in-app not-found state.
  if (!SLUG_PATTERN.test(slug)) {
    notFound();
  }
  return <CatalogProductDetail slug={slug} />;
}
