import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiError } from '@/shared/api/client';
import { ProductsAdmin } from './products-admin';
import type { AdminCategory, AuthedRequest, CatalogProduct, ShopProduct } from '../model/types';

function category(overrides: Partial<AdminCategory>): AdminCategory {
  return {
    id: 'cat',
    scope: 'CATALOG',
    name: 'Kategorija',
    slug: 'kategorija',
    parentId: null,
    displayOrder: 0,
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function catalogProduct(overrides: Partial<CatalogProduct> = {}): CatalogProduct {
  return {
    id: 'cp1',
    categoryId: 'cc1',
    name: 'Šventinis tortas',
    slug: 'sventinis-tortas',
    description: 'Ilgas',
    primaryImageUrl: 'https://example.com/cake.jpg',
    galleryImageUrls: [],
    status: 'PUBLISHED',
    featured: true,
    displayOrder: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    category: { id: 'cc1', name: 'Tortai', slug: 'tortai' },
    tags: [],
    ...overrides,
  };
}

function shopProduct(overrides: Partial<ShopProduct> = {}): ShopProduct {
  return {
    ...catalogProduct({ id: 'sp1', name: 'Tamsus šokoladas' }),
    shortDescription: 'Trumpas',
    sku: 'SKU-1',
    priceCents: 990,
    salePriceCents: null,
    saleStartsAt: null,
    saleEndsAt: null,
    stockQuantity: 5,
    category: { id: 'sc1', name: 'Plytelės', slug: 'plyteles' },
    ...overrides,
  };
}

function makeRequest() {
  return vi.fn(async (path: string, options?: { method?: string; body?: unknown }) => {
    if (path === '/api/admin/media/images') {
      return {
        key: 'products/11111111-1111-4111-8111-111111111111.webp',
        url: '/media/products/11111111-1111-4111-8111-111111111111.webp',
        width: 100,
        height: 80,
        mimeType: 'image/webp',
        sizeBytes: 1234,
      };
    }
    if (path.startsWith('/api/admin/catalog/categories')) {
      return [category({ id: 'cc1', name: 'Tortai', slug: 'tortai' })];
    }
    if (path.startsWith('/api/admin/catalog/tags')) {
      if (options?.method === 'POST') {
        const body = options.body as { name: string };
        return {
          id: `tag-${body.name.toLowerCase()}`,
          name: body.name,
          slug: body.name.toLowerCase(),
        };
      }
      return [
        { id: 'tag-chocolate', name: 'Šokoladas', slug: 'sokoladas' },
        { id: 'tag-cherry', name: 'Vyšnios', slug: 'vysnios' },
      ];
    }
    if (path.startsWith('/api/admin/shop/categories')) {
      return [category({ id: 'sc1', scope: 'SHOP', name: 'Plytelės', slug: 'plyteles' })];
    }
    if (path.startsWith('/api/admin/catalog/products')) {
      return { items: [catalogProduct()], page: 1, pageSize: 20, total: 1, totalPages: 1 };
    }
    if (path.startsWith('/api/admin/shop/products')) {
      return {
        items: [
          shopProduct(),
          shopProduct({
            id: 'sp2',
            name: 'Pieniškas šokoladas',
            priceCents: 1500,
            salePriceCents: 1200,
            stockQuantity: 0,
          }),
        ],
        page: 1,
        pageSize: 20,
        total: 2,
        totalPages: 1,
      };
    }
    throw new Error(`unexpected path ${path}`);
  }) as unknown as AuthedRequest;
}

describe('ProductsAdmin', () => {
  it('separates the catalogue and e-shop sections via tabs', async () => {
    const request = makeRequest();
    const user = userEvent.setup();
    render(<ProductsAdmin request={request} />);

    expect(screen.getByRole('tab', { name: 'Prekių katalogas' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('tab', { name: 'El. parduotuvė' })).toHaveAttribute(
      'aria-selected',
      'false',
    );

    // Catalogue is loaded first and the e-shop endpoints are not touched.
    await waitFor(
      () => expect(request).toHaveBeenCalledWith('/api/admin/catalog/products?page=1&pageSize=20'),
      { timeout: 3000 },
    );
    expect(request).not.toHaveBeenCalledWith(expect.stringContaining('/api/admin/shop/products'));

    await user.click(screen.getByRole('tab', { name: 'El. parduotuvė' }));
    await waitFor(
      () => expect(request).toHaveBeenCalledWith('/api/admin/shop/products?page=1&pageSize=20'),
      { timeout: 3000 },
    );
    expect(await screen.findByTestId('shop-products-table')).toBeInTheDocument();
  });

  it('shows no commercial columns for catalogue products', async () => {
    const request = makeRequest();
    render(<ProductsAdmin request={request} />);

    const table = within(await screen.findByTestId('catalog-products-table'));
    expect(table.queryByText('Kaina')).toBeNull();
    expect(table.queryByText('Likutis')).toBeNull();
    expect(screen.queryByText('Nėra likučio')).toBeNull();
    expect(table.getByText('Šventinis tortas')).toBeInTheDocument();
  });

  it('shows price, sale price and the Nėra likučio state for e-shop products', async () => {
    const request = makeRequest();
    const user = userEvent.setup();
    render(<ProductsAdmin request={request} />);

    await user.click(screen.getByRole('tab', { name: 'El. parduotuvė' }));
    const table = within(await screen.findByTestId('shop-products-table'));

    expect(table.getByText('9,90 €')).toBeInTheDocument();
    expect(table.getByText('12,00 €')).toBeInTheDocument();
    expect(table.getByText('15,00 €')).toBeInTheDocument();
    expect(table.getByText('Nėra likučio')).toBeInTheDocument();
  });

  it('shows empty states when there is no data', async () => {
    const request = vi.fn(async (path: string) => {
      if (path.startsWith('/api/admin/catalog/tags')) {
        return [];
      }
      if (path.includes('/categories')) {
        return [];
      }
      return { items: [], page: 1, pageSize: 20, total: 0, totalPages: 0 };
    }) as unknown as AuthedRequest;

    render(<ProductsAdmin request={request} />);

    expect(await screen.findByText('Kategorijų nerasta.')).toBeInTheDocument();
    expect(screen.getByText('Prekių nerasta.')).toBeInTheDocument();
  });

  it('shows an error state with retry when loading fails', async () => {
    const request = vi
      .fn()
      .mockRejectedValue(new ApiError(500, 'boom')) as unknown as AuthedRequest;

    render(<ProductsAdmin request={request} />);

    expect(
      (await screen.findAllByText('Įvyko netikėta klaida. Bandykite dar kartą.')).length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: 'Bandyti dar kartą' }).length).toBeGreaterThan(0);
  });

  it('requires a base price before creating an e-shop product', async () => {
    const request = makeRequest();
    const user = userEvent.setup();
    render(<ProductsAdmin request={request} />);

    await user.click(screen.getByRole('tab', { name: 'El. parduotuvė' }));
    await screen.findByTestId('shop-products-table');
    await user.click(screen.getByRole('button', { name: 'Nauja prekė' }));

    await user.selectOptions(screen.getByLabelText('Kategorija'), 'sc1');
    await user.type(screen.getByLabelText('Pavadinimas'), 'Naujas');
    await user.type(screen.getByLabelText('Nuorodos fragmentas (slug)'), 'naujas');
    await user.upload(
      screen.getByLabelText('Pagrindinė nuotrauka'),
      new File([new Uint8Array([1, 2, 3])], 'p.png', { type: 'image/png' }),
    );
    await screen.findByAltText('Pagrindinės nuotraukos peržiūra');
    await user.type(screen.getByLabelText('Trumpas aprašymas'), 'Trumpas');
    await user.type(screen.getByLabelText('Pilnas aprašymas'), 'Ilgas');

    await user.click(screen.getByRole('button', { name: 'Išsaugoti' }));

    expect(await screen.findByText('Įveskite bazinę kainą.')).toBeInTheDocument();
    expect(request).not.toHaveBeenCalledWith(
      '/api/admin/shop/products',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('uses the Prekės label while keeping the two area labels', async () => {
    const request = makeRequest();
    render(<ProductsAdmin request={request} />);

    expect(screen.getByRole('heading', { name: 'Prekės', level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Prekių katalogas' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'El. parduotuvė' })).toBeInTheDocument();
  });

  it('creates a root category without an empty-string parent and with numeric displayOrder', async () => {
    const request = makeRequest();
    const user = userEvent.setup();
    render(<ProductsAdmin request={request} />);

    await screen.findByTestId('catalog-products-table');
    await user.click(screen.getByRole('button', { name: 'Nauja kategorija' }));
    await user.type(screen.getByLabelText('Pavadinimas'), 'Tortai');
    await user.type(screen.getByLabelText('Nuorodos fragmentas (slug)'), 'tortai');
    await user.click(screen.getByRole('button', { name: 'Išsaugoti' }));

    await waitFor(
      () =>
        expect(request).toHaveBeenCalledWith('/api/admin/catalog/categories', {
          method: 'POST',
          body: { name: 'Tortai', slug: 'tortai', displayOrder: 0, isActive: true },
        }),
      { timeout: 3000 },
    );
    // The list is refreshed after a successful create.
    const categoryCalls = () =>
      vi.mocked(request).mock.calls.filter(([path]) => path === '/api/admin/catalog/categories');
    await waitFor(() => expect(categoryCalls().length).toBeGreaterThan(1), { timeout: 3000 });
  });

  it('sends the parent UUID when creating a child category', async () => {
    const request = makeRequest();
    const user = userEvent.setup();
    render(<ProductsAdmin request={request} />);

    await screen.findByTestId('catalog-products-table');
    await user.click(screen.getByRole('button', { name: 'Nauja kategorija' }));
    await user.type(screen.getByLabelText('Pavadinimas'), 'Šventiniai tortai');
    await user.type(screen.getByLabelText('Nuorodos fragmentas (slug)'), 'sventiniai-tortai');
    await user.selectOptions(screen.getByLabelText('Tėvinė kategorija'), 'cc1');
    await user.click(screen.getByRole('button', { name: 'Išsaugoti' }));

    await waitFor(
      () =>
        expect(request).toHaveBeenCalledWith('/api/admin/catalog/categories', {
          method: 'POST',
          body: {
            name: 'Šventiniai tortai',
            slug: 'sventiniai-tortai',
            displayOrder: 0,
            isActive: true,
            parentId: 'cc1',
          },
        }),
      { timeout: 3000 },
    );
  });

  it('offers a newly created category immediately in the same-scope product form', async () => {
    const catalog: AdminCategory[] = [category({ id: 'cc1', name: 'Tortai', slug: 'tortai' })];
    const request = vi.fn(async (path: string, options?: { method?: string; body?: unknown }) => {
      if (path.startsWith('/api/admin/catalog/categories')) {
        if (options?.method === 'POST') {
          const body = options.body as { name: string; slug: string };
          const created = category({ id: 'cc2', name: body.name, slug: body.slug });
          catalog.push(created);
          return created;
        }
        return [...catalog];
      }
      if (path.startsWith('/api/admin/catalog/products')) {
        return { items: [], page: 1, pageSize: 20, total: 0, totalPages: 0 };
      }
      if (path.startsWith('/api/admin/shop/categories')) {
        return [];
      }
      if (path.startsWith('/api/admin/shop/products')) {
        return { items: [], page: 1, pageSize: 20, total: 0, totalPages: 0 };
      }
      throw new Error(`unexpected path ${path}`);
    }) as unknown as AuthedRequest;
    const user = userEvent.setup();
    render(<ProductsAdmin request={request} />);

    await screen.findByTestId('categories-table');
    await user.click(screen.getByRole('button', { name: 'Nauja kategorija' }));
    await user.type(screen.getByLabelText('Pavadinimas'), 'Šventiniai tortai');
    await user.type(screen.getByLabelText('Nuorodos fragmentas (slug)'), 'sventiniai-tortai');
    await user.click(screen.getByRole('button', { name: 'Išsaugoti' }));

    // Category table refreshes…
    await waitFor(
      () =>
        expect(
          within(screen.getByTestId('categories-table')).getByText('Šventiniai tortai'),
        ).toBeInTheDocument(),
      { timeout: 3000 },
    );

    // …and the same-scope product form offers it immediately, with no reload.
    await user.click(screen.getByRole('button', { name: 'Nauja prekė' }));
    const select = screen.getByLabelText('Kategorija');
    expect(within(select).getByRole('option', { name: 'Šventiniai tortai' })).toBeInTheDocument();
  });

  it('does not offer a catalogue category in the e-shop product form', async () => {
    const request = vi.fn(async (path: string) => {
      if (path.startsWith('/api/admin/catalog/categories')) {
        return [category({ id: 'cc1', name: 'Tortai', slug: 'tortai' })];
      }
      if (path.startsWith('/api/admin/catalog/products')) {
        return { items: [], page: 1, pageSize: 20, total: 0, totalPages: 0 };
      }
      if (path.startsWith('/api/admin/shop/categories')) {
        return [category({ id: 'sc1', scope: 'SHOP', name: 'Plytelės', slug: 'plyteles' })];
      }
      if (path.startsWith('/api/admin/shop/products')) {
        return { items: [], page: 1, pageSize: 20, total: 0, totalPages: 0 };
      }
      throw new Error(`unexpected path ${path}`);
    }) as unknown as AuthedRequest;
    const user = userEvent.setup();
    render(<ProductsAdmin request={request} />);

    await user.click(screen.getByRole('tab', { name: 'El. parduotuvė' }));
    const categoriesTable = within(await screen.findByTestId('categories-table'));
    await waitFor(() => expect(categoriesTable.getByText('Plytelės')).toBeInTheDocument(), {
      timeout: 3000,
    });

    await user.click(screen.getByRole('button', { name: 'Nauja prekė' }));
    const select = screen.getByLabelText('Kategorija');

    expect(within(select).getByRole('option', { name: 'Plytelės' })).toBeInTheDocument();
    expect(within(select).queryByRole('option', { name: 'Tortai' })).toBeNull();
  });

  it('offers only active categories for new products but keeps an inactive current category when editing', async () => {
    const request = vi.fn(async (path: string) => {
      if (path.startsWith('/api/admin/catalog/categories')) {
        return [
          category({ id: 'active', name: 'Tortai', slug: 'tortai', isActive: true }),
          category({ id: 'inactive', name: 'Sena', slug: 'sena', isActive: false }),
        ];
      }
      if (path.startsWith('/api/admin/catalog/products')) {
        return {
          items: [
            catalogProduct({
              id: 'cp1',
              name: 'Senas tortas',
              categoryId: 'inactive',
              category: { id: 'inactive', name: 'Sena', slug: 'sena' },
            }),
          ],
          page: 1,
          pageSize: 20,
          total: 1,
          totalPages: 1,
        };
      }
      if (path.startsWith('/api/admin/shop/categories')) {
        return [];
      }
      if (path.startsWith('/api/admin/shop/products')) {
        return { items: [], page: 1, pageSize: 20, total: 0, totalPages: 0 };
      }
      throw new Error(`unexpected path ${path}`);
    }) as unknown as AuthedRequest;
    const user = userEvent.setup();
    render(<ProductsAdmin request={request} />);

    await screen.findByTestId('catalog-products-table');

    // New product: the inactive category is not selectable.
    await user.click(screen.getByRole('button', { name: 'Nauja prekė' }));
    let select = screen.getByLabelText('Kategorija') as HTMLSelectElement;
    expect(within(select).getByRole('option', { name: 'Tortai' })).toBeInTheDocument();
    expect(within(select).queryByRole('option', { name: /Sena/ })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Atšaukti' }));

    // Editing keeps the (now inactive) current category, clearly labelled.
    await user.click(screen.getByRole('button', { name: 'Redaguoti prekę Senas tortas' }));
    select = screen.getByLabelText('Kategorija') as HTMLSelectElement;
    expect(within(select).getByRole('option', { name: 'Sena (neaktyvi)' })).toBeInTheDocument();
    expect(select.value).toBe('inactive');
  });

  it('hides the short description for catalogue products and shows tags instead', async () => {
    const request = makeRequest();
    const user = userEvent.setup();
    render(<ProductsAdmin request={request} />);

    await screen.findByTestId('catalog-products-table');
    await user.click(screen.getByRole('button', { name: 'Nauja prekė' }));

    expect(screen.queryByLabelText('Trumpas aprašymas')).toBeNull();
    expect(screen.getByLabelText('Žymos')).toBeInTheDocument();
  });

  it('shows the short description and no tags for e-shop products', async () => {
    const request = makeRequest();
    const user = userEvent.setup();
    render(<ProductsAdmin request={request} />);

    await screen.findByTestId('catalog-products-table');
    await user.click(screen.getByRole('tab', { name: 'El. parduotuvė' }));
    await screen.findByTestId('shop-products-table');
    await user.click(screen.getByRole('button', { name: 'Nauja prekė' }));

    expect(screen.getByLabelText('Trumpas aprašymas')).toBeInTheDocument();
    expect(screen.queryByLabelText('Žymos')).toBeNull();
  });

  it('assigns reusable catalogue tags by name and never duplicates them', async () => {
    const request = makeRequest();
    const user = userEvent.setup();
    render(<ProductsAdmin request={request} />);

    await screen.findByTestId('catalog-products-table');
    await user.click(screen.getByRole('button', { name: 'Nauja prekė' }));

    // Existing tags are offered as chips; selecting one needs no slug typing.
    await user.click(screen.getByRole('button', { name: '+ Šokoladas' }));
    expect(screen.getByLabelText('Pašalinti žymą Šokoladas')).toBeInTheDocument();

    // A brand-new tag is created from a human name only.
    await user.type(screen.getByLabelText('Žymos'), 'Riešutai');
    await user.click(screen.getByRole('button', { name: 'Pridėti žymą' }));
    await waitFor(() =>
      expect(request).toHaveBeenCalledWith('/api/admin/catalog/tags', {
        method: 'POST',
        body: { name: 'Riešutai' },
      }),
    );
    expect(await screen.findByLabelText('Pašalinti žymą Riešutai')).toBeInTheDocument();
    // Already-selected tags are no longer offered, so duplicates cannot occur.
    expect(screen.queryByRole('button', { name: '+ Riešutai' })).toBeNull();
    expect(screen.queryByRole('button', { name: '+ Šokoladas' })).toBeNull();
  });

  it('submits catalogue tag ids when editing a product', async () => {
    const request = makeRequest();
    const user = userEvent.setup();
    render(<ProductsAdmin request={request} />);

    await screen.findByTestId('catalog-products-table');
    await user.click(screen.getByRole('button', { name: 'Redaguoti prekę Šventinis tortas' }));
    await user.click(screen.getByRole('button', { name: '+ Vyšnios' }));
    await user.click(screen.getByRole('button', { name: 'Išsaugoti' }));

    await waitFor(() =>
      expect(request).toHaveBeenCalledWith(
        '/api/admin/catalog/products/cp1',
        expect.objectContaining({
          method: 'PATCH',
          body: expect.objectContaining({ tagIds: ['tag-cherry'] }),
        }),
      ),
    );
  });

  it('shows a live catalogue description counter and blocks over-limit saves', async () => {
    const request = makeRequest();
    const user = userEvent.setup();
    render(<ProductsAdmin request={request} />);

    await screen.findByTestId('catalog-products-table');
    await user.click(screen.getByRole('button', { name: 'Redaguoti prekę Šventinis tortas' }));

    const counter = screen.getByTestId('catalog-description-counter');
    expect(counter).toHaveTextContent('/ 1000');

    fireEvent.change(screen.getByLabelText('Pilnas aprašymas'), {
      target: { value: 'a'.repeat(1001) },
    });
    expect(counter).toHaveTextContent('1001 / 1000');

    await user.click(screen.getByRole('button', { name: 'Išsaugoti' }));
    expect(
      await screen.findByText('Aprašymas per ilgas: leidžiama iki 1000 simbolių.'),
    ).toBeInTheDocument();
    expect(
      vi
        .mocked(request)
        .mock.calls.find(
          ([path, options]) =>
            path === '/api/admin/catalog/products/cp1' && options?.method === 'PATCH',
        ),
    ).toBeUndefined();

    // Exactly 1000 characters is accepted.
    fireEvent.change(screen.getByLabelText('Pilnas aprašymas'), {
      target: { value: 'a'.repeat(1000) },
    });
    expect(counter).toHaveTextContent('1000 / 1000');
    await user.click(screen.getByRole('button', { name: 'Išsaugoti' }));
    await waitFor(() =>
      expect(request).toHaveBeenCalledWith(
        '/api/admin/catalog/products/cp1',
        expect.objectContaining({
          method: 'PATCH',
          body: expect.objectContaining({ description: 'a'.repeat(1000) }),
        }),
      ),
    );
  });

  it('does not show the catalogue description counter for e-shop products', async () => {
    const request = makeRequest();
    const user = userEvent.setup();
    render(<ProductsAdmin request={request} />);

    await screen.findByTestId('catalog-products-table');
    await user.click(screen.getByRole('tab', { name: 'El. parduotuvė' }));
    await screen.findByTestId('shop-products-table');
    await user.click(screen.getByRole('button', { name: 'Nauja prekė' }));

    expect(screen.getByLabelText('Pilnas aprašymas')).toBeInTheDocument();
    expect(screen.queryByTestId('catalog-description-counter')).toBeNull();
  });

  it('flags an existing over-limit catalogue description and blocks its re-save', async () => {
    const long = 'a'.repeat(1200);
    const request = vi.fn(async (path: string) => {
      if (path.startsWith('/api/admin/catalog/tags')) {
        return [];
      }
      if (path.startsWith('/api/admin/catalog/categories')) {
        return [category({ id: 'cc1', name: 'Tortai', slug: 'tortai' })];
      }
      if (path.startsWith('/api/admin/catalog/products')) {
        return {
          items: [catalogProduct({ description: long })],
          page: 1,
          pageSize: 20,
          total: 1,
          totalPages: 1,
        };
      }
      if (path.startsWith('/api/admin/shop/categories')) {
        return [];
      }
      if (path.startsWith('/api/admin/shop/products')) {
        return { items: [], page: 1, pageSize: 20, total: 0, totalPages: 0 };
      }
      throw new Error(`unexpected path ${path}`);
    }) as unknown as AuthedRequest;
    const user = userEvent.setup();
    render(<ProductsAdmin request={request} />);

    // The over-limit state is visible in the list without opening the record.
    expect(await screen.findByText('Per ilgas aprašymas')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Redaguoti prekę Šventinis tortas' }));
    expect(screen.getByTestId('catalog-description-counter')).toHaveTextContent('1200 / 1000');

    // The employee must shorten it; the over-limit text is never silently cut.
    await user.click(screen.getByRole('button', { name: 'Išsaugoti' }));
    expect(
      await screen.findByText('Aprašymas per ilgas: leidžiama iki 1000 simbolių.'),
    ).toBeInTheDocument();
    expect(
      vi
        .mocked(request)
        .mock.calls.find(
          ([path, options]) =>
            path === '/api/admin/catalog/products/cp1' && options?.method === 'PATCH',
        ),
    ).toBeUndefined();
  });
});
