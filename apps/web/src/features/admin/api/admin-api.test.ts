import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/shared/api/client';
import { deleteUser } from './admin-api';
import type { AuthedRequest } from '../model/types';

describe('deleteUser', () => {
  it('issues DELETE to the encoded user path and resolves for a 204', async () => {
    const request = vi.fn().mockResolvedValue(undefined);

    await expect(deleteUser(request as unknown as AuthedRequest, 'a b/c')).resolves.toBeUndefined();

    expect(request).toHaveBeenCalledWith('/api/admin/users/a%20b%2Fc', { method: 'DELETE' });
  });

  it('propagates a non-2xx failure to the caller', async () => {
    const request = vi.fn().mockRejectedValue(new ApiError(409, 'conflict', 'LAST_ADMIN'));

    await expect(deleteUser(request as unknown as AuthedRequest, 'u1')).rejects.toBeInstanceOf(
      ApiError,
    );
  });
});
