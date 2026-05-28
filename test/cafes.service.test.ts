import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { CafesService } from '../src/cafes/cafes.service';

function createService(overrides: any = {}) {
  const prisma = {
    cafe: {
      findMany: async () => [],
      count: async () => 0,
    },
    ...overrides.prisma,
  };
  const routeDistance = {
    getRouteDistances: async () => null,
    ...overrides.routeDistance,
  };

  return {
    service: new CafesService(prisma as any, routeDistance as any),
    prisma,
    routeDistance,
  };
}

test('findAll passes rating sort to Prisma before pagination', async () => {
  let findManyArgs: any;
  const { service } = createService({
    prisma: {
      cafe: {
        findMany: async (args: any) => {
          findManyArgs = args;
          return [{ id: 'cafe-1', _count: { savedCafes: 3 } }];
        },
        count: async () => 1,
      },
    },
  });

  const result = await service.findAll({ sort: 'rating', page: 2, limit: 9 });

  assert.equal(findManyArgs.skip, 9);
  assert.equal(findManyArgs.take, 9);
  assert.deepEqual(findManyArgs.orderBy[0], { rating: { sort: 'desc', nulls: 'last' } });
  assert.equal(findManyArgs.select.rating, true);
  assert.deepEqual(result.data, [{ id: 'cafe-1', savedCount: 3 }]);
  assert.deepEqual(result.meta, { total: 1, page: 2, limit: 9, totalPages: 1 });
});

test('findAll defaults popular sort to featured and saved cafes', async () => {
  let findManyArgs: any;
  const { service } = createService({
    prisma: {
      cafe: {
        findMany: async (args: any) => {
          findManyArgs = args;
          return [];
        },
        count: async () => 0,
      },
    },
  });

  await service.findAll({});

  assert.deepEqual(findManyArgs.orderBy, [
    { isFeatured: 'desc' },
    { featuredOrder: { sort: 'asc', nulls: 'last' } },
    { savedCafes: { _count: 'desc' } },
    { createdAt: 'desc' },
  ]);
});
