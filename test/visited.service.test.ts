import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { VisitedService } from '../src/visited/visited.service';

function createService() {
  const visited: any[] = [];
  const prisma = {
    cafe: {
      findFirst: async ({ where }: any) =>
        where.id === 'cafe-1' && where.isPublished ? { id: where.id } : null,
    },
    visitedCafe: {
      upsert: async ({ where, create }: any) => {
        const existing = visited.find(
          (item) =>
            item.userId === where.userId_cafeId.userId &&
            item.cafeId === where.userId_cafeId.cafeId,
        );
        if (!existing) visited.push(create);
        return existing ?? create;
      },
      deleteMany: async ({ where }: any) => {
        const length = visited.length;
        for (let index = visited.length - 1; index >= 0; index -= 1) {
          if (visited[index].userId === where.userId && visited[index].cafeId === where.cafeId) {
            visited.splice(index, 1);
          }
        }
        return { count: length - visited.length };
      },
    },
    $queryRaw: async () => [
      {
        id: 'visited-1',
        cafeId: 'cafe-1',
        createdAt: new Date('2026-07-12T00:00:00.000Z'),
        cafe: { id: 'cafe-1', name: 'Quán A', nameEn: 'Cafe A', lat: 10.1, lng: 106.2 },
      },
    ],
  };

  return { service: new VisitedService(prisma as any), visited };
}

test('mark visited is idempotent', async () => {
  const { service, visited } = createService();

  assert.deepEqual(await service.mark('user-1', 'cafe-1'), { cafeId: 'cafe-1', visited: true });
  assert.deepEqual(await service.mark('user-1', 'cafe-1'), { cafeId: 'cafe-1', visited: true });
  assert.equal(visited.length, 1);
});

test('unmark visited removes marker', async () => {
  const { service, visited } = createService();

  await service.mark('user-1', 'cafe-1');
  assert.deepEqual(await service.unmark('user-1', 'cafe-1'), {
    cafeId: 'cafe-1',
    visited: false,
  });
  assert.equal(visited.length, 0);
});

test('get visited returns cafe entries for FE map', async () => {
  const { service } = createService();

  const [entry] = await service.getVisited('user-1', 'en');

  assert.equal(entry.cafe.name, 'Cafe A');
  assert.equal(entry.cafe.lat, 10.1);
  assert.equal(entry.visitedAt.toISOString(), '2026-07-12T00:00:00.000Z');
});
