import { describe, expect, it } from 'vitest';
import { GET } from './route';

describe('GET /health/ready', () => {
  it('returns 200 with an ok status', async () => {
    const response = GET();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: 'ok' });
  });
});
