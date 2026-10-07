import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiError } from '@/shared/api/client';
import { getCatalogProduct } from '../api/catalog-api';
import { CatalogProductDetail } from './catalog-product-detail';

vi.mock('../api/catalog-api', () => ({
  getCatalogCategory: vi.fn(),
  getCatalogProduct: vi.fn(),
}));

const mockedProduct = vi.mocked(getCatalogProduct);

function payload() {
  return {
    name: 'Tortas A',
    slug: 'tortas-a',
    description: 'Pirmas sakinys.\n\nAntras sakinys.',
    primaryImageUrl: '/media/products/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.webp',
    featured: true,
    displayOrder: 0,
    category: { name: 'Tortai', slug: 'tortai' },
    tags: [{ name: 'Vyšnios', slug: 'vysnios' }],
    rating: { average: 4.9, count: 61 },
  };
}

beforeEach(() => {
  mockedProduct.mockReset();
  document.title = '';
});

afterEach(() => {
  document.querySelector('meta[name="description"]')?.remove();
});

describe('CatalogProductDetail', () => {
  it('renders the product, category context, breadcrumb and back link', async () => {
    mockedProduct.mockResolvedValue(payload());
    render(<CatalogProductDetail slug="tortas-a" />);

    expect(await screen.findByRole('heading', { name: 'Tortas A', level: 1 })).toBeInTheDocument();
    expect(screen.getByText('Pirmas sakinys.')).toBeInTheDocument();
    expect(screen.getByText('Antras sakinys.')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Tortas A' })).toBeInTheDocument();
    // Tags and the verified imported rating are shown where appropriate.
    expect(screen.getByText('#vyšnios')).toBeInTheDocument();
    expect(screen.getByText('★ 4,9 (61)')).toBeInTheDocument();
    // Breadcrumb and category links both lead back to /tortai.
    const backLinks = screen.getAllByRole('link', { name: 'Tortai' });
    expect(backLinks.length).toBeGreaterThan(0);
    for (const link of backLinks) {
      expect(link).toHaveAttribute('href', '/tortai');
    }
    // Informational only.
    expect(screen.queryByText(/€/)).toBeNull();
    expect(screen.queryByText(/Krepšel|Likutis|Išparduota/i)).toBeNull();
  });

  it('uses the responsive two-column desktop layout with text beside the image', async () => {
    mockedProduct.mockResolvedValue(payload());
    render(<CatalogProductDetail slug="tortas-a" />);

    const heading = await screen.findByRole('heading', { name: 'Tortas A', level: 1 });
    const image = screen.getByRole('img', { name: 'Tortas A' });
    const grid = document.querySelector('.lg\\:grid-cols-2');

    // Desktop: image left, text right; mobile stacks naturally into one column.
    expect(grid).not.toBeNull();
    expect(grid).toHaveClass('grid');
    // The always-single-column editorial variant is gone.
    expect(document.querySelector('.max-w-\\[45rem\\]')).toBeNull();
    // The image sits before the text column in DOM order.
    expect(image.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
  });

  it('sets the document title and meta description from the product data', async () => {
    mockedProduct.mockResolvedValue(payload());
    render(<CatalogProductDetail slug="tortas-a" />);

    await screen.findByRole('heading', { name: 'Tortas A', level: 1 });
    await waitFor(() => expect(document.title).toBe('Tortas A — Šokolado meistrai'));
    expect(document.querySelector('meta[name="description"]')?.getAttribute('content')).toBe(
      'Pirmas sakinys. Antras sakinys.',
    );
  });

  it('shows no rating at all when the product has no imported rating', async () => {
    mockedProduct.mockResolvedValue({ ...payload(), rating: null, tags: [] });
    render(<CatalogProductDetail slug="tortas-a" />);

    await screen.findByRole('heading', { name: 'Tortas A', level: 1 });
    expect(screen.queryByText(/★/)).toBeNull();
    expect(screen.queryByLabelText('Žymos')).toBeNull();
  });

  it('keeps the reading-oriented max-w-6xl width and never widens to max-w-7xl', async () => {
    mockedProduct.mockResolvedValue(payload());
    render(<CatalogProductDetail slug="tortas-a" />);

    await screen.findByRole('heading', { name: 'Tortas A', level: 1 });
    expect(document.querySelector('.max-w-6xl')).not.toBeNull();
    expect(document.querySelector('.max-w-7xl')).toBeNull();
  });

  it('shows a not-found state for a 404', async () => {
    mockedProduct.mockRejectedValue(new ApiError(404, 'not found'));
    render(<CatalogProductDetail slug="nezinomas" />);

    expect(await screen.findByText('Produktas nerastas.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Grįžti į Tortai' })).toHaveAttribute(
      'href',
      '/tortai',
    );
  });

  it('shows an error state with retry for other failures', async () => {
    mockedProduct.mockRejectedValueOnce(new ApiError(500, 'boom')).mockResolvedValue(payload());
    render(<CatalogProductDetail slug="tortas-a" />);

    expect(
      await screen.findByText('Nepavyko įkelti produkto. Bandykite dar kartą.'),
    ).toBeInTheDocument();

    await userEvent.setup().click(screen.getByRole('button', { name: 'Bandyti dar kartą' }));
    expect(await screen.findByRole('heading', { name: 'Tortas A', level: 1 })).toBeInTheDocument();
  });
});
