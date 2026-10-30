import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { AddressInfo } from 'node:net';
import { CafeRevalidateService } from '../src/admin/cafes/cafe-revalidate.service';
import { AdminCafesService } from '../src/admin/cafes/admin-cafes.service';

test('cafe webhook delivery and persistence guarantees over HTTP', async (t) => {
  let calls: { authorization: string; body: unknown; time: number }[] = [];
  let mode = 'success';
  const server = createServer(async (req, res) => {
    let body = '';
    for await (const chunk of req) body += chunk;
    calls.push({
      authorization: req.headers.authorization,
      body: JSON.parse(body),
      time: Date.now(),
    });
    res.setHeader('Content-Type', 'application/json');
    if (mode === 'network') return req.socket.destroy();
    if (mode === 'timeout') return;
    if (mode === 'body-timeout') {
      res.writeHead(200);
      res.write('{');
      return;
    }
    if (mode === 'invalid') return res.end('{');
    if (mode === 'false') return res.end('{"revalidated":false}');
    if (mode === 'missing') return res.end('{}');
    if (mode === 'string') return res.end('{"revalidated":"true"}');
    if (mode === 'null') return res.end('null');
    if (/^\d+$/.test(mode)) res.statusCode = Number(mode);
    if (mode === 'recover' && calls.length === 1) res.statusCode = 503;
    res.end('{"revalidated":true}');
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => {
    server.closeAllConnections();
    server.close();
  });
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/revalidate-cafes`;
  const logs: any[] = [];
  for (const method of ['log', 'warn', 'error'] as const) {
    t.mock.method(console, method, (line: string) => logs.push(JSON.parse(line)));
  }
  const service = new CafeRevalidateService({
    get: (key: string) => ({ FRONTEND_REVALIDATE_URL: url, REVALIDATE_SECRET: 'test-secret' })[key],
  } as any);

  await t.test('success requires explicit acknowledgement and preserves payload', async () => {
    await service.trigger('ten-quan');
    assert.equal(calls.length, 1);
    assert.equal(calls[0].authorization, 'Bearer test-secret');
    assert.deepEqual(calls[0].body, { reason: 'cafe_changed', slug: 'ten-quan' });
    assert.deepEqual(logs.at(-1), {
      type: 'cafe.revalidate.done',
      slug: 'ten-quan',
      status: 200,
      attempt: 1,
    });
    calls = [];
    await service.trigger();
    assert.deepEqual(calls[0].body, { reason: 'cafe_changed' });
  });

  for (const scenario of ['401', '403', '400', 'invalid', 'false', 'missing', 'string', 'null']) {
    await t.test(`does not retry ${scenario}`, async () => {
      mode = scenario;
      calls = [];
      await service.trigger('ten-quan');
      assert.equal(calls.length, 1);
      assert.equal(logs.at(-1).type, 'cafe.revalidate.failed');
    });
  }
  for (const scenario of ['429', '500', '503', 'network', 'timeout', 'body-timeout', 'recover']) {
    await t.test(`retries ${scenario} once after 500 ms`, async () => {
      mode = scenario;
      calls = [];
      const start = Date.now();
      await service.trigger('ten-quan');
      assert.equal(calls.length, 2);
      assert.ok(calls[1].time - calls[0].time >= 490);
      assert.equal(logs.at(-1).attempt, 2);
      assert.equal(
        logs.at(-1).type,
        scenario === 'recover' ? 'cafe.revalidate.done' : 'cafe.revalidate.failed',
      );
      if (scenario.includes('timeout')) {
        assert.ok(Date.now() - start >= 6400);
        assert.ok(Date.now() - start < 8500);
      }
    });
  }
  await t.test('missing config skips requests without exposing credentials', async () => {
    calls = [];
    await new CafeRevalidateService({ get: () => undefined } as any).trigger('ten-quan');
    assert.equal(calls.length, 0);
    assert.equal(logs.at(-1).type, 'cafe.revalidate.skipped');
    assert.ok(!JSON.stringify(logs).includes('test-secret'));
  });

  await t.test(
    'admin saves before delivery; failed delivery preserves saved hours; failed save sends nothing',
    async () => {
      mode = '401';
      calls = [];
      let saved = false;
      let failSave = false;
      const prisma = {
        cafe: {
          findUnique: async () => ({ id: 'cafe-1', slug: 'ten-quan' }),
          update: async ({ data }: any) => {
            if (failSave) throw new Error('DB failed');
            saved = true;
            return { id: 'cafe-1', slug: 'ten-quan', ...data };
          },
        },
      };
      const admin = new AdminCafesService(
        prisma as any,
        {} as any,
        {
          trigger: async (slug: string) => {
            assert.ok(saved);
            return service.trigger(slug);
          },
        } as any,
      );
      const result = await admin.updateCafe('cafe-1', {
        openingTime: '08:30',
        closingTime: '22:15',
      });
      assert.ok(saved);
      assert.equal(calls.length, 1);
      assert.equal(result.openingTime.toISOString().slice(11, 16), '08:30');
      assert.equal(result.closingTime.toISOString().slice(11, 16), '22:15');
      failSave = true;
      await assert.rejects(admin.updateCafe('cafe-1', { openingTime: '09:00' }), /DB failed/);
      assert.equal(calls.length, 1);
    },
  );
});

test('detail HTTP response disables intermediary caching for both locales', async (t) => {
  const { Test } = await import('@nestjs/testing');
  const { JwtService } = await import('@nestjs/jwt');
  const { CafesController } = await import('../src/cafes/cafes.controller');
  const { CafesService } = await import('../src/cafes/cafes.service');
  const { CafeVotesService } = await import('../src/cafes/cafe-votes.service');
  const { RecentlyViewedService } = await import('../src/recently-viewed/recently-viewed.service');
  const module = await Test.createTestingModule({
    controllers: [CafesController],
    providers: [
      {
        provide: CafesService,
        useValue: { findBySlug: async (slug: string, locale: string) => ({ slug, locale }) },
      },
      { provide: CafeVotesService, useValue: {} },
      { provide: JwtService, useValue: {} },
      { provide: RecentlyViewedService, useValue: {} },
    ],
  }).compile();
  const app = module.createNestApplication({ logger: false });
  t.after(() => app.close());
  await app.listen(0, '127.0.0.1');
  for (const locale of ['vi', 'en']) {
    const response = await fetch(`${await app.getUrl()}/cafes/ten-quan?locale=${locale}`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    assert.deepEqual(await response.json(), { slug: 'ten-quan', locale });
  }
});
