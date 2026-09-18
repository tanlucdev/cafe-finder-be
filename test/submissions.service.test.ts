import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { SubmissionsService } from '../src/submissions/submissions.service';

test('getMe lists visible current-user submissions newest first with linked cafe fields', async () => {
  let findManyArgs: any;
  const prisma = {
    cafeSubmission: {
      findMany: async (args: any) => {
        findManyArgs = args;
        return [];
      },
    },
  };
  const service = new SubmissionsService(prisma as any);

  assert.deepEqual(await service.getMe('user-1'), []);
  assert.deepEqual(findManyArgs.where, { submittedById: 'user-1', isHidden: false });
  assert.deepEqual(findManyArgs.orderBy, { createdAt: 'desc' });
  assert.deepEqual(findManyArgs.include.createdCafe.select, {
    id: true,
    name: true,
    slug: true,
    address: true,
    district: true,
    coverImage: true,
    isPublished: true,
  });
});
