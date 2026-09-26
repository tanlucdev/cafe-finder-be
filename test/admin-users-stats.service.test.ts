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
        return [
          {
            id: 'user-1',
            email: 'user@test.dev',
            registrationMethod: 'EMAIL',
            quizCompletedCount: 2,
            _count: { submissions: 3, cafeReviews: 4, quizResults: 5 },
          },
        ];
      },
      count: async () => 12,
      groupBy: async () => [
        { registrationMethod: 'EMAIL', _count: { _all: 8 } },
        { registrationMethod: 'GOOGLE', _count: { _all: 3 } },
        { registrationMethod: 'UNKNOWN', _count: { _all: 1 } },
      ],
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
    registrationMethod: true,
    isHidden: true,
    createdAt: true,
    quizCompletedCount: true,
    _count: {
      select: {
        submissions: { where: { isHidden: false } },
        cafeReviews: { where: { isHidden: false } },
        quizResults: true,
      },
    },
  });
  assert.deepEqual(result.data[0], {
    id: 'user-1',
    email: 'user@test.dev',
    registrationMethod: 'EMAIL',
    quizCompletedCount: 2,
    submissionCount: 3,
    reviewCount: 4,
    quizResultCount: 5,
  });
  assert.deepEqual(findManyArgs.where, { isHidden: false });
  assert.deepEqual(result.meta, {
    total: 12,
    page: 2,
    limit: 5,
    totalPages: 3,
    registrationMethods: { EMAIL: 8, GOOGLE: 3, UNKNOWN: 1 },
  });
});

test('AdminUsersService hides users but blocks self hide and last admin hide', async () => {
  const updates: any[] = [];
  const prisma = {
    user: {
      findUnique: async ({ where }: any) => ({
        id: where.id,
        role: where.id === 'admin-1' ? 'ADMIN' : 'USER',
      }),
      count: async () => 1,
      update: async (args: any) => {
        updates.push(args);
        return { id: args.where.id, isHidden: args.data.isHidden };
      },
    },
  };
  const service = new AdminUsersService(prisma as any);

  await assert.rejects(() => service.hideUser('me', 'me'), /Cannot hide yourself/);
  await assert.rejects(() => service.hideUser('admin-1', 'admin-2'), /Cannot hide the last admin/);
  assert.deepEqual(await service.hideUser('user-1', 'admin-1'), { id: 'user-1', isHidden: true });
  assert.equal(updates[0].data.isHidden, true);
});

test('AdminUsersService bulk hides users with admin safety checks', async () => {
  let updateManyArgs: any;
  const prisma = {
    user: {
      findMany: async ({ where }: any) =>
        where.id.in.map((id: string) => ({ id, role: id.startsWith('admin') ? 'ADMIN' : 'USER' })),
      count: async () => 2,
      updateMany: async (args: any) => {
        updateManyArgs = args;
        return { count: args.where.id.in.length };
      },
    },
    $transaction: async (fn: any) => fn(prisma),
  };
  const service = new AdminUsersService(prisma as any);

  await assert.rejects(() => service.hideUsers([], 'admin-1'), /No users selected/);
  await assert.rejects(() => service.hideUsers(['admin-1'], 'admin-1'), /Cannot hide yourself/);
  await assert.rejects(
    () => service.hideUsers(['admin-2', 'admin-3'], 'admin-1'),
    /Cannot hide the last admin/,
  );
  assert.deepEqual(await service.hideUsers(['user-1', 'user-1', 'user-2'], 'admin-1'), {
    count: 2,
  });
  assert.deepEqual(updateManyArgs.where, { id: { in: ['user-1', 'user-2'] }, isHidden: false });
  assert.deepEqual(updateManyArgs.data, { isHidden: true });
});

test('AdminStatsService preserves existing fields and returns digest counts', async () => {
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
      count: async (args?: any) => {
        countCalls.push(['user', args]);
        return 5;
      },
    },
    blogPost: { count: async (args?: any) => (args?.where?.isPublished ? 4 : 1) },
    feedback: { count: async (args?: any) => (args?.where?.status ? 9 : 6) },
    cafeReview: { count: async () => 7 },
  };
  const service = new AdminStatsService(prisma as any);

  const result = await service.getStats('2026-09-22');

  assert.deepEqual(result, {
    total_cafes: 10,
    published_cafes: 8,
    featured_cafes: 3,
    pending_submissions: 2,
    total_users: 5,
    draft_cafes: 10,
    published_blogs: 4,
    draft_blogs: 1,
    today: {
      date: '2026-09-22',
      new_cafes: 10,
      new_blogs: 1,
      new_users: 5,
      new_submissions: 2,
      new_feedback: 6,
      new_reviews: 7,
    },
    queues: {
      pending_submissions: 2,
      new_feedback: 9,
      visible_reviews: 7,
      hidden_reviews: 7,
    },
  });
  assert.deepEqual(countCalls[3], [
    'submission',
    { where: { status: 'pending', isHidden: false } },
  ]);
  assert.deepEqual(countCalls[4], ['user', { where: { isHidden: false } }]);
});

test('AdminStatsService uses UTC+7 bounds for an explicit date and excludes hidden records', async () => {
  const calls: Record<string, any[]> = {
    cafe: [],
    blog: [],
    user: [],
    submission: [],
    feedback: [],
    review: [],
  };
  const count = (name: string) => async (args?: any) => {
    calls[name].push(args);
    return 0;
  };
  const prisma = {
    cafe: { count: count('cafe') },
    blogPost: { count: count('blog') },
    user: { count: count('user') },
    cafeSubmission: { count: count('submission') },
    feedback: { count: count('feedback') },
    cafeReview: { count: count('review') },
  };

  await new AdminStatsService(prisma as any).getStats('2026-09-22');

  const createdAt = {
    gte: new Date('2026-09-21T17:00:00.000Z'),
    lt: new Date('2026-09-22T17:00:00.000Z'),
  };
  assert.deepEqual(calls.cafe[4], { where: { createdAt, isHidden: false } });
  assert.deepEqual(calls.blog[2], { where: { createdAt, isHidden: false } });
  assert.deepEqual(calls.user[1], { where: { createdAt, isHidden: false } });
  assert.deepEqual(calls.submission[1], { where: { createdAt, isHidden: false } });
  assert.deepEqual(calls.feedback[0], { where: { createdAt, isHidden: false } });
  assert.deepEqual(calls.review[0], { where: { createdAt, isHidden: false } });
  assert.deepEqual(calls.submission[0], { where: { status: 'pending', isHidden: false } });
  assert.deepEqual(calls.feedback[1], { where: { status: 'NEW', isHidden: false } });
});
