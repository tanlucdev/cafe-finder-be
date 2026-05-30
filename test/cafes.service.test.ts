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

test('findAll localizes cafe fields and searches both languages', async () => {
  let findManyArgs: any;
  const { service } = createService({
    prisma: {
      cafe: {
        findMany: async (args: any) => {
          findManyArgs = args;
          return [
            {
              id: 'cafe-1',
              name: 'Cà Phê Sáng',
              nameEn: 'Morning Coffee',
              address: 'Quận 1',
              addressEn: 'District 1',
              oneLiner: 'Yên tĩnh',
              oneLinerEn: 'Quiet spot',
              vibes: ['Yên tĩnh'],
              vibesEn: ['Quiet'],
              purposes: ['Làm việc'],
              purposesEn: ['Work'],
              amenities: ['Ổ cắm'],
              amenitiesEn: ['Power outlets'],
              _count: { savedCafes: 2 },
            },
          ];
        },
        count: async () => 1,
      },
    },
  });

  const result = await service.findAll({
    locale: 'en',
    search: 'quiet',
    vibes: ['Quiet'],
    purposes: ['Work'],
  });

  assert.equal(findManyArgs.where.AND[0].OR.length, 6);
  assert.deepEqual(findManyArgs.where.AND[1], {
    OR: [{ vibes: { hasSome: ['Quiet'] } }, { vibesEn: { hasSome: ['Quiet'] } }],
  });
  assert.deepEqual(findManyArgs.where.AND[2], {
    OR: [{ purposes: { hasSome: ['Work'] } }, { purposesEn: { hasSome: ['Work'] } }],
  });
  assert.equal(findManyArgs.select.vibesEn, true);
  assert.equal(findManyArgs.select.purposesEn, true);
  assert.equal(findManyArgs.select.amenities, true);
  assert.equal(findManyArgs.select.amenitiesEn, true);
  assert.deepEqual(result.data, [
    {
      id: 'cafe-1',
      name: 'Morning Coffee',
      address: 'District 1',
      oneLiner: 'Quiet spot',
      vibes: ['Quiet'],
      purposes: ['Work'],
      amenities: ['Power outlets'],
      savedCount: 2,
    },
  ]);
});
