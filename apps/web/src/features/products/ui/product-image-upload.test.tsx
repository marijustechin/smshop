import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProductsAdmin } from './products-admin';
import type { AdminCategory, AuthedRequest, CatalogProduct, UploadedImage } from '../model/types';

const MEDIA_URL = '/media/products/11111111-1111-4111-8111-111111111111.webp';

function uploadedImage(overrides: Partial<UploadedImage> = {}): UploadedImage {
  return {
    key: 'products/11111111-1111-4111-8111-111111111111.webp',
    url: MEDIA_URL,
    width: 100,
    height: 80,
    mimeType: 'image/webp',
    sizeBytes: 1234,
    ...overrides,
  };
}

function category(overrides: Partial<AdminCategory> = {}): AdminCategory {
  return {
    id: 'cc1',
    scope: 'CATALOG',
    name: 'Tortai',
    slug: 'tortai',
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
    name: 'Senas tortas',
    slug: 'senas-tortas',
    description: 'Ilgas',
    primaryImageUrl: 'https://old-wordpress.example.com/uploads/cake.jpg',
    galleryImageUrls: [],
    status: 'PUBLISHED',
    featured: false,
    displayOrder: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    category: { id: 'cc1', name: 'Tortai', slug: 'tortai' },
    tags: [],
    ...overrides,
  };
}

function makeRequest(
  options: {
    upload?: () => Promise<UploadedImage>;
    catalogProducts?: CatalogProduct[];
  } = {},
) {
  return vi.fn(async (path: string, callOptions?: { method?: string; body?: unknown }) => {
    if (path === '/api/admin/media/images') {
      return options.upload ? options.upload() : uploadedImage();
    }
    if (path.startsWith('/api/admin/catalog/categories')) {
      return [category()];
    }
    if (path.startsWith('/api/admin/catalog/tags')) {
      return [];
    }
    if (path.startsWith('/api/admin/shop/categories')) {
      return [];
    }
    if (path.startsWith('/api/admin/catalog/products')) {
      if (callOptions?.method === 'POST' || callOptions?.method === 'PATCH') {
        return catalogProduct();
      }
      return {
        items: options.catalogProducts ?? [],
        page: 1,
        pageSize: 20,
        total: options.catalogProducts?.length ?? 0,
        totalPages: 1,
      };
    }
    if (path.startsWith('/api/admin/shop/products')) {
      return { items: [], page: 1, pageSize: 20, total: 0, totalPages: 1 };
    }
    throw new Error(`unexpected path ${path}`);
  }) as unknown as AuthedRequest;
}

async function fillNewProduct(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Nauja prekė' }));
  await user.selectOptions(screen.getByLabelText('Kategorija'), 'cc1');
  await user.type(screen.getByLabelText('Pavadinimas'), 'Šventinis tortas');
  await user.type(screen.getByLabelText('Nuorodos fragmentas (slug)'), 'sventinis-tortas');
  await user.type(screen.getByLabelText('Pilnas aprašymas'), 'Ilgas');
}

const imageFile = (type = 'image/png', name = 'photo.png') =>
  new File([new Uint8Array([1, 2, 3, 4])], name, { type });

describe('Product image upload', () => {
  it('does not expose a URL text field and blocks saving a new product without an upload', async () => {
    const request = makeRequest();
    const user = userEvent.setup();
    render(<ProductsAdmin request={request} />);

    await screen.findByText('Prekių nerasta.');
    await fillNewProduct(user);

    expect(screen.queryByLabelText('Pagrindinė nuotrauka (URL)')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Išsaugoti' }));

    expect(await screen.findByText('Įkelkite pagrindinę nuotrauką.')).toBeInTheDocument();
    expect(
      vi
        .mocked(request)
        .mock.calls.find(
          ([path, options]) => path === '/api/admin/catalog/products' && options?.method === 'POST',
        ),
    ).toBeUndefined();
  });

  it('uploads an image, shows a preview, and saves using the returned /media path', async () => {
    const request = makeRequest();
    const user = userEvent.setup();
    render(<ProductsAdmin request={request} />);

    await screen.findByText('Prekių nerasta.');
    await fillNewProduct(user);

    await user.upload(screen.getByLabelText('Pagrindinė nuotrauka'), imageFile());

    const preview = await screen.findByAltText('Pagrindinės nuotraukos peržiūra');
    expect(preview.getAttribute('src') ?? '').toContain(MEDIA_URL);
    expect(request).toHaveBeenCalledWith(
      '/api/admin/media/images',
      expect.objectContaining({ method: 'POST', body: expect.any(FormData) }),
    );

    await user.click(screen.getByRole('button', { name: 'Išsaugoti' }));
    await waitFor(() =>
      expect(request).toHaveBeenCalledWith(
        '/api/admin/catalog/products',
        expect.objectContaining({
          method: 'POST',
          body: expect.objectContaining({ primaryImageUrl: MEDIA_URL }),
        }),
      ),
    );
  });

  it('shows a clear error for an unsupported file type without uploading', async () => {
    const request = makeRequest();
    const user = userEvent.setup();
    render(<ProductsAdmin request={request} />);

    await screen.findByText('Prekių nerasta.');
    await fillNewProduct(user);

    // fireEvent bypasses the input's `accept` filter so the client-side guard is
    // what rejects the unsupported type.
    fireEvent.change(screen.getByLabelText('Pagrindinė nuotrauka'), {
      target: { files: [imageFile('image/gif', 'x.gif')] },
    });

    expect(
      await screen.findByText('Palaikomi tik JPEG, PNG ir WebP formatai.'),
    ).toBeInTheDocument();
    expect(
      vi.mocked(request).mock.calls.find(([path]) => path === '/api/admin/media/images'),
    ).toBeUndefined();
  });

  it('shows an uploading state while the image is being processed', async () => {
    let resolveUpload: (value: UploadedImage) => void = () => {};
    const pending = new Promise<UploadedImage>((resolve) => {
      resolveUpload = resolve;
    });
    const request = makeRequest({ upload: () => pending });
    const user = userEvent.setup();
    render(<ProductsAdmin request={request} />);

    await screen.findByText('Prekių nerasta.');
    await fillNewProduct(user);

    await user.upload(screen.getByLabelText('Pagrindinė nuotrauka'), imageFile());

    expect(await screen.findByText('Įkeliama…')).toBeInTheDocument();
    resolveUpload(uploadedImage());
    expect(await screen.findByAltText('Pagrindinės nuotraukos peržiūra')).toBeInTheDocument();
  });

  it('preserves a legacy external image on edit when it is not replaced', async () => {
    const legacy = 'https://old-wordpress.example.com/uploads/cake.jpg';
    const request = makeRequest({ catalogProducts: [catalogProduct({ primaryImageUrl: legacy })] });
    const user = userEvent.setup();
    render(<ProductsAdmin request={request} />);

    await screen.findByTestId('catalog-products-table');
    await user.click(screen.getByRole('button', { name: 'Redaguoti prekę Senas tortas' }));

    // Legacy preview is shown, and there is no URL text field.
    const preview = await screen.findByAltText('Pagrindinės nuotraukos peržiūra');
    expect(preview).toHaveAttribute('src', legacy);
    expect(screen.queryByLabelText('Pagrindinė nuotrauka (URL)')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Išsaugoti' }));
    await waitFor(() =>
      expect(request).toHaveBeenCalledWith(
        '/api/admin/catalog/products/cp1',
        expect.objectContaining({
          method: 'PATCH',
          body: expect.objectContaining({ primaryImageUrl: legacy }),
        }),
      ),
    );
  });

  it('lets an admin replace a legacy image with an uploaded one', async () => {
    const legacy = 'https://old-wordpress.example.com/uploads/cake.jpg';
    const request = makeRequest({ catalogProducts: [catalogProduct({ primaryImageUrl: legacy })] });
    const user = userEvent.setup();
    render(<ProductsAdmin request={request} />);

    await screen.findByTestId('catalog-products-table');
    await user.click(screen.getByRole('button', { name: 'Redaguoti prekę Senas tortas' }));
    await screen.findByAltText('Pagrindinės nuotraukos peržiūra');

    await user.upload(screen.getByLabelText('Pagrindinė nuotrauka'), imageFile());
    await waitFor(() =>
      expect(
        screen.getByAltText('Pagrindinės nuotraukos peržiūra').getAttribute('src') ?? '',
      ).toContain(MEDIA_URL),
    );

    await user.click(screen.getByRole('button', { name: 'Išsaugoti' }));
    await waitFor(() =>
      expect(request).toHaveBeenCalledWith(
        '/api/admin/catalog/products/cp1',
        expect.objectContaining({
          method: 'PATCH',
          body: expect.objectContaining({ primaryImageUrl: MEDIA_URL }),
        }),
      ),
    );
  });
});
