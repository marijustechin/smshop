import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiError } from '@/shared/api/client';
import { getCatalogCategory } from '../api/catalog-api';
import { CatalogCategory } from './catalog-category';

vi.mock('../api/catalog-api', () => ({
  getCatalogCategory: vi.fn(),
  getCatalogProduct: vi.fn(),
}));

const mockedCategory = vi.mocked(getCatalogCategory);

function payload() {
  return {
    category: { name: 'Tortai', slug: 'tortai' },
    products: [
      {
        name: 'Tortas A',
        slug: 'tortas-a',
        description: 'Ilgas A',
        primaryImageUrl: '/media/products/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.webp',
        featured: true,
        displayOrder: 0,
        tags: [
          { name: 'Šokoladas', slug: 'sokoladas' },
          { name: 'Grietinėlė', slug: 'grietinele' },
        ],
        rating: { average: 4.9, count: 61 },
      },
      {
        name: 'Tortas B',
        slug: 'tortas-b',
        description: 'Ilgas B',
        primaryImageUrl: 'https://old-wordpress.example.com/b.jpg',
        featured: false,
        displayOrder: 1,
        tags: [],
        rating: null,
      },
    ],
  };
}

beforeEach(() => {
  mockedCategory.mockReset();
});

describe('CatalogCategory', () => {
  it('renders real product fields with card links, tags and verified ratings only', async () => {
    mockedCategory.mockResolvedValue(payload());
    render(<CatalogCategory slug="tortai" intro="Įžanga apie tortus." />);

    expect(await screen.findByRole('heading', { name: 'Tortai', level: 1 })).toBeInTheDocument();
    expect(screen.getByText('Įžanga apie tortus.')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Tortas A' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Tortas B' })).toBeInTheDocument();

    // Tags render the human name lowercased, not the machine slug.
    expect(screen.getByText('#šokoladas')).toBeInTheDocument();
    expect(screen.getByText('#grietinėlė')).toBeInTheDocument();

    // Only the product with a valid imported rating shows a rating; the other
    // shows no star at all.
    expect(screen.getByText('★ 4,9 (61)')).toBeInTheDocument();
    expect(screen.getAllByText(/★/)).toHaveLength(1);

    // No short description is rendered any more.
    expect(screen.queryByText('Ilgas A')).toBeNull();

    expect(screen.getByRole('link', { name: /Tortas A/ })).toHaveAttribute(
      'href',
      '/tortai/tortas-a',
    );
    expect(screen.getByRole('link', { name: /Tortas B/ })).toHaveAttribute(
      'href',
      '/tortai/tortas-b',
    );

    // No e-shop / commercial elements.
    expect(screen.queryByText(/€/)).toBeNull();
    expect(screen.queryByText(/Krepšel/i)).toBeNull();
    expect(screen.queryByText(/Likutis|Išparduota/i)).toBeNull();
  });

  it('shows a loading state first', () => {
    mockedCategory.mockReturnValue(new Promise<never>(() => {}));
    render(<CatalogCategory slug="tortai" intro="x" />);
    expect(screen.getByText('Kraunama…')).toBeInTheDocument();
  });

  it('uses the widened 1280px (max-w-7xl) listing width', async () => {
    mockedCategory.mockResolvedValue(payload());
    render(<CatalogCategory slug="tortai" intro="x" />);

    await screen.findByRole('heading', { name: 'Tortai', level: 1 });
    expect(document.querySelector('.max-w-7xl')).not.toBeNull();
  });

  it('shows an empty state when the category has no products', async () => {
    mockedCategory.mockResolvedValue({
      category: { name: 'Tortai', slug: 'tortai' },
      products: [],
    });
    render(<CatalogCategory slug="tortai" intro="x" />);
    expect(await screen.findByText('Šiuo metu produktų nėra.')).toBeInTheDocument();
  });

  it('shows a not-found state for a 404', async () => {
    mockedCategory.mockRejectedValue(new ApiError(404, 'not found'));
    render(<CatalogCategory slug="tortai" intro="x" />);
    expect(await screen.findByText('Kategorija nerasta.')).toBeInTheDocument();
  });

  it('shows an error state with retry for other failures', async () => {
    const request = vi.mocked(getCatalogCategory);
    request.mockRejectedValueOnce(new ApiError(500, 'boom')).mockResolvedValue(payload());
    render(<CatalogCategory slug="tortai" intro="x" />);

    expect(
      await screen.findByText('Nepavyko įkelti kategorijos. Bandykite dar kartą.'),
    ).toBeInTheDocument();

    await userEvent.setup().click(screen.getByRole('button', { name: 'Bandyti dar kartą' }));
    await waitFor(() => expect(request).toHaveBeenCalledTimes(2));
    expect(await screen.findByText('#šokoladas')).toBeInTheDocument();
  });
});
