import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { RecentlyViewedService } from '../src/recently-viewed/recently-viewed.service';

function createService() {
  let tick = 0;
  const cafes = new Map<string, any>([
    ['cafe-1', { id: 'cafe-1', name: 'Một', nameEn: 'One', slug: 'one', isPublished: true, isHidden: false }],
    ['cafe-2', { id: 'cafe-2', name: 'Hai', nameEn: 'Two', slug: 'two', isPublished: true, isHidden: false }],
    ['hidden', { id: 'hidden', name: 'Ẩn', nameEn: 'Hidden', slug: 'hidden', isPublished: true, isHidden: true }],
    ['draft', { id: 'draft', name: 'Nháp', nameEn: 'Draft', slug: 'draft', isPublished: false, isHidden: false }],
  ]);
  const rows = new Map<string, any>();
  const key = (userId: string, cafeId: string) => `${userId}:${cafeId}`;
  const recentlyViewedCafe = {
    upsert: async ({ where, create }: any) => {
      const rowKey = key(where.userId_cafeId.userId, where.userId_cafeId.cafeId);
      const row = rows.get(rowKey) || { id: `row-${rows.size + 1}`, ...create };
      row.lastViewedAt = new Date(++tick);
      rows.set(rowKey, row);
      return row;
    },
    findMany: async ({ where, orderBy, skip = 0, take, select }: any) => {
      let values = [...rows.values()].filter((row) => row.userId === where.userId);
      if (where.cafe) {
        values = values.filter((row) => {
          const cafe = cafes.get(row.cafeId);
          return cafe.isPublished && !cafe.isHidden;
        });
      }
      if (orderBy) values.sort((a, b) => b.lastViewedAt.getTime() - a.lastViewedAt.getTime());
      values = values.slice(skip, take == null ? undefined : skip + take);
      return values.map((row) =>
        select.id ? { id: row.id } : { lastViewedAt: row.lastViewedAt, cafe: cafes.get(row.cafeId) },
      );
    },
    deleteMany: async ({ where }: any) => {
      for (const [rowKey, row] of rows) if (where.id.in.includes(row.id)) rows.delete(rowKey);
    },
  };
  const prisma = {
    recentlyViewedCafe,
    $transaction: async (callback: any) => callback({ recentlyViewedCafe }),
  };

  return { service: new RecentlyViewedService(prisma as any), rows };
}

test('recent views upsert one row, reorder it, and retain the latest 20', async () => {
  const { service, rows } = createService();

  await service.recordView('user-1', 'cafe-1');
  await service.recordView('user-1', 'cafe-2');
  await service.recordView('user-1', 'cafe-1');
  assert.equal(rows.size, 2);
  assert.deepEqual(
    (await service.getRecentlyViewed('user-1')).map((item) => item.cafe.id),
    ['cafe-1', 'cafe-2'],
  );

  for (let index = 3; index <= 21; index++) {
    await service.recordView('user-1', `cafe-${index}`);
  }
  assert.equal(rows.size, 20);
  assert.equal([...rows.values()].some((row) => row.cafeId === 'cafe-2'), false);
});

test('recent views apply limit, hide unavailable cafes, and localize cafes', async () => {
  const { service } = createService();

  await service.recordView('user-1', 'cafe-1');
  await service.recordView('user-1', 'hidden');
  await service.recordView('user-1', 'draft');

  const result = await service.getRecentlyViewed('user-1', 'en', 1);
  assert.equal(result.length, 1);
  assert.equal(result[0].cafe.name, 'One');
  assert.equal('nameEn' in result[0].cafe, false);
});
