import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { CafesService } from '../src/cafes/cafes.service';
import { serializeLocalizedCafe } from '../src/cafes/cafe.mapper';

function createService(overrides: any = {}) {
  const prisma = {
    cafe: {
      findMany: async () => [],
      count: async () => 0,
    },
    cafeVote: {
      groupBy: async () => [],
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

test('serializeLocalizedCafe dedupes localized list values case-insensitively', () => {
  const cafe = serializeLocalizedCafe(
    {
      amenities: ['wifi', 'ổ cắm', 'điều hoà', 'WiFi', 'Chỗ đậu xe', 'Ổ cắm'],
      amenitiesEn: [],
      tags: ['Ngoài trời', 'ngoài trời'],
      tagsEn: [],
    },
    'vi',
  );

  assert.deepEqual(cafe.amenities, ['wifi', 'ổ cắm', 'điều hoà', 'Chỗ đậu xe']);
  assert.deepEqual(cafe.tags, ['Ngoài trời']);
});

test('findAll passes rating sort to Prisma before pagination', async () => {
  let findManyArgs: any;
  const { service } = createService({
    prisma: {
      cafe: {
        findMany: async (args: any) => {
          findManyArgs = args;
          return [{ id: 'cafe-1', _count: { savedCafes: 3, cafeVotes: 4 } }];
        },
        count: async () => 1,
      },
      cafeVote: {
        groupBy: async ({ where }: any) =>
          where.createdAt ? [] : [{ cafeId: 'cafe-1', _count: { cafeId: 4 } }],
      },
    },
  });

  const result = await service.findAll({ sort: 'rating', page: 2, limit: 9 });

  assert.equal(findManyArgs.skip, 9);
  assert.equal(findManyArgs.take, 9);
  assert.deepEqual(findManyArgs.orderBy[0], { rating: { sort: 'desc', nulls: 'last' } });
  assert.equal(findManyArgs.select.rating, true);
  assert.deepEqual(result.data, [
    { id: 'cafe-1', savedCount: 3, voteCount: 4, weeklyVoteCount: 0 },
  ]);
  assert.deepEqual(result.meta, { total: 1, page: 2, limit: 9, totalPages: 1 });
});

test('findAll popular sort uses previous-week votes before all-time and featured', async () => {
  const { service } = createService({
    prisma: {
      cafe: {
        findMany: async () => [
          {
            id: 'featured',
            isFeatured: true,
            featuredOrder: 1,
            createdAt: new Date('2026-01-01'),
            _count: { savedCafes: 9, cafeVotes: 1 },
          },
          {
            id: 'all-time',
            isFeatured: false,
            featuredOrder: null,
            createdAt: new Date('2026-01-02'),
            _count: { savedCafes: 1, cafeVotes: 8 },
          },
          {
            id: 'weekly',
            isFeatured: false,
            featuredOrder: null,
            createdAt: new Date('2026-01-03'),
            _count: { savedCafes: 1, cafeVotes: 2 },
          },
        ],
        count: async () => 3,
      },
      cafeVote: {
        groupBy: async ({ where }: any) =>
          where.createdAt
            ? [{ cafeId: 'weekly', _count: { cafeId: 3 } }]
            : [
                { cafeId: 'featured', _count: { cafeId: 1 } },
                { cafeId: 'all-time', _count: { cafeId: 8 } },
                { cafeId: 'weekly', _count: { cafeId: 2 } },
              ],
      },
    },
  });

  const result = await service.findAll({});

  assert.deepEqual(
    result.data.map((cafe: any) => cafe.id),
    ['weekly', 'all-time', 'featured'],
  );
  assert.deepEqual(
    result.data.map((cafe: any) => cafe.weeklyVoteCount),
    [3, 0, 0],
  );
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
              tags: ['ngoài trời'],
              tagsEn: ['Outdoor'],
              _count: { savedCafes: 2, cafeVotes: 5 },
            },
          ];
        },
        count: async () => 1,
      },
      cafeVote: {
        groupBy: async ({ where }: any) =>
          where.createdAt ? [] : [{ cafeId: 'cafe-1', _count: { cafeId: 5 } }],
      },
    },
  });

  const result = await service.findAll({
    locale: 'en',
    search: 'quiet',
    vibes: ['Quiet'],
    purposes: ['Work'],
    tags: ['Outdoor'],
  });

  assert.equal(findManyArgs.where.AND[0].OR.length, 6);
  assert.deepEqual(findManyArgs.where.AND[1], {
    OR: [{ vibes: { hasSome: ['Quiet'] } }, { vibesEn: { hasSome: ['Quiet'] } }],
  });
  assert.deepEqual(findManyArgs.where.AND[2], {
    OR: [{ purposes: { hasSome: ['Work'] } }, { purposesEn: { hasSome: ['Work'] } }],
  });
  assert.deepEqual(findManyArgs.where.AND[3], {
    OR: [{ tags: { hasSome: ['Outdoor'] } }, { tagsEn: { hasSome: ['Outdoor'] } }],
  });
  assert.equal(findManyArgs.select.vibesEn, true);
  assert.equal(findManyArgs.select.purposesEn, true);
  assert.equal(findManyArgs.select.amenities, true);
  assert.equal(findManyArgs.select.amenitiesEn, true);
  assert.equal(findManyArgs.select.tags, true);
  assert.equal(findManyArgs.select.tagsEn, true);
  assert.deepEqual(result.data, [
    {
      id: 'cafe-1',
      name: 'Morning Coffee',
      address: 'District 1',
      oneLiner: 'Quiet spot',
      vibes: ['Quiet'],
      purposes: ['Work'],
      amenities: ['Power outlets'],
      tags: ['Outdoor'],
      savedCount: 2,
      voteCount: 5,
      weeklyVoteCount: 0,
    },
  ]);
});

test('findAll still returns cafes when vote table is missing', async () => {
  const { service } = createService({
    prisma: {
      cafe: {
        findMany: async () => [
          {
            id: 'cafe-1',
            createdAt: new Date('2026-01-01'),
            _count: { savedCafes: 2 },
          },
        ],
        count: async () => 1,
      },
      cafeVote: {
        groupBy: async () => {
          throw new Error('relation "cafe_votes" does not exist');
        },
      },
    },
  });

  const result = await service.findAll({});

  assert.deepEqual(result.data, [
    {
      id: 'cafe-1',
      createdAt: new Date('2026-01-01'),
      savedCount: 2,
      voteCount: 0,
      weeklyVoteCount: 0,
    },
  ]);
});
