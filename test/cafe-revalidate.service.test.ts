import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { CafeRevalidateService } from '../src/admin/cafes/cafe-revalidate.service';

test('CafeRevalidateService posts cafe slug to frontend webhook', async () => {
  const calls: any[] = [];
  const originalFetch = global.fetch;
  global.fetch = (async (url: string, init: RequestInit) => {
    calls.push([url, init]);
    return { ok: true, status: 200 } as Response;
  }) as typeof fetch;

  try {
    const service = new CafeRevalidateService({
      get: (key: string) =>
        ({ FRONTEND_REVALIDATE_URL: 'https://fe.test/api/revalidate-cafes', REVALIDATE_SECRET: 's' })[
          key
        ],
    } as any);

    await service.trigger('ten-quan');

    assert.equal(calls[0][0], 'https://fe.test/api/revalidate-cafes');
    assert.equal(calls[0][1].headers.Authorization, 'Bearer s');
    assert.equal(calls[0][1].body, JSON.stringify({ reason: 'cafe_changed', slug: 'ten-quan' }));
  } finally {
    global.fetch = originalFetch;
  }
});
