import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { AdminStatsService } from '../src/admin/stats/admin-stats.service';
import { AdminUsersService } from '../src/admin/users/admin-users.service';

test('AdminUsersService paginates users without selecting passwordHash', async () => {
  let findManyArgs: any;
  const prisma = {
    user: {
      findMany: async (args: any) => {
        findManyArgs = args;
        return [{ id: 'user-1', email: 'user@test.dev' }];
      },
      count: async () => 12,
    },
  };
  const service = new AdminUsersService(prisma as any);

  const result = await service.listUsers(2, 5);

  assert.equal(findManyArgs.skip, 5);
  assert.equal(findManyArgs.take, 5);
  assert.equal(findManyArgs.select.passwordHash, undefined);
  assert.deepEqual(findManyArgs.select, {
    id: true,
    email: true,
    displayName: true,
    role: true,
    createdAt: true,
  });
  assert.deepEqual(result.meta, { total: 12, page: 2, limit: 5, totalPages: 3 });
});

test('AdminStatsService returns cafe, submission, and user counts', async () => {
  const countCalls: any[] = [];
  const prisma = {
    cafe: {
      count: async (args?: any) => {
        countCalls.push(['cafe', args]);
        if (args?.where?.isPublished) return 8;
        if (args?.where?.isFeatured) return 3;
        return 10;
      },
    },
    cafeSubmission: {
      count: async (args?: any) => {
        countCalls.push(['submission', args]);
        return 2;
      },
    },
    user: {
      count: async () => {
        countCalls.push(['user']);
        return 5;
      },
    },
  };
  const service = new AdminStatsService(prisma as any);

  const result = await service.getStats();

  assert.deepEqual(result, {
    total_cafes: 10,
    published_cafes: 8,
    featured_cafes: 3,
    pending_submissions: 2,
    total_users: 5,
  });
  assert.deepEqual(countCalls[3], ['submission', { where: { status: 'pending' } }]);
});
