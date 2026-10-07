import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiRequest } from './client';

function stubFetch(response: Response) {
  const fetchMock = vi.fn().mockResolvedValue(response);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('apiRequest', () => {
  it('resolves 204 No Content without reading or parsing a body', async () => {
    const text = vi.fn(async () => '');
    const response = { status: 204, ok: true, statusText: '', text } as unknown as Response;
    const fetchMock = stubFetch(response);

    await expect(
      apiRequest<void>('/api/admin/users/u1', { method: 'DELETE', accessToken: 'token-1' }),
    ).resolves.toBeUndefined();

    expect(text).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/admin/users/u1'),
      expect.objectContaining({
        method: 'DELETE',
        headers: expect.objectContaining({ Authorization: 'Bearer token-1' }),
      }),
    );
  });

  it('parses a JSON body for a successful 2xx response', async () => {
    const response = {
      status: 200,
      ok: true,
      statusText: 'OK',
      text: async () => JSON.stringify({ items: [] }),
    } as unknown as Response;
    stubFetch(response);

    await expect(apiRequest('/api/admin/users')).resolves.toEqual({ items: [] });
  });

  it('throws a typed ApiError carrying status and code for a non-2xx response', async () => {
    const response = {
      status: 403,
      ok: false,
      statusText: 'Forbidden',
      text: async () => JSON.stringify({ message: 'Forbidden', code: 'INSUFFICIENT_ROLE' }),
    } as unknown as Response;
    stubFetch(response);

    const error = await apiRequest('/api/admin/users/u1', { method: 'DELETE' }).catch((e) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(403);
    expect((error as ApiError).code).toBe('INSUFFICIENT_ROLE');
  });

  it('maps a network failure to ApiError status 0', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('failed to fetch')));

    const error = await apiRequest('/api/admin/users/u1', { method: 'DELETE' }).catch((e) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(0);
  });

  it('passes a FormData body through without JSON stringifying or a JSON content type', async () => {
    const response = {
      status: 201,
      ok: true,
      statusText: 'Created',
      text: async () => JSON.stringify({ url: '/media/products/x.webp' }),
    } as unknown as Response;
    const fetchMock = stubFetch(response);
    const form = new FormData();
    form.append('file', new File(['bytes'], 'photo.png', { type: 'image/png' }));

    await apiRequest('/api/admin/media/images', { method: 'POST', body: form });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.body).toBe(form);
    expect((init.headers as Record<string, string>)['Content-Type']).toBeUndefined();
  });
});
