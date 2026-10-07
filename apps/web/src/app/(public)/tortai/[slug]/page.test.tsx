import { describe, expect, it, vi } from 'vitest';
import { generateMetadata, default as TortaiProductPage } from './page';

vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
}));

describe('Tortai product page', () => {
  it('builds canonical metadata from the slug', async () => {
    const meta = await generateMetadata({ params: Promise.resolve({ slug: 'tortas-a' }) });

    expect(meta.title).toBe('Tortas — Šokolado meistrai');
    expect(meta.alternates).toEqual({ canonical: '/tortai/tortas-a' });
  });

  it('calls the framework notFound for a malformed slug', async () => {
    await expect(
      TortaiProductPage({ params: Promise.resolve({ slug: 'Bad Slug' }) }),
    ).rejects.toThrow('NEXT_NOT_FOUND');
  });

  it('renders the product detail component for a valid slug', async () => {
    const element = await TortaiProductPage({ params: Promise.resolve({ slug: 'tortas-a' }) });
    expect(element).toBeTruthy();
  });
});
