import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { NotFoundException } from '@nestjs/common';
import { QuizService } from '../src/quiz/quiz.service';

function createService(initialCount = 0) {
  let quizCompletedCount = initialCount;
  const prisma = {
    user: {
      update: async (args: any) => {
        assert.deepEqual(args.data, { quizCompletedCount: { increment: 1 } });
        quizCompletedCount += 1;
        return { quizCompletedCount };
      },
      findUnique: async (args: any) =>
        args.where.id === 'missing' ? null : { quizCompletedCount },
    },
  };

  return { service: new QuizService(prisma as any), getCount: () => quizCompletedCount };
}

test('recordCompletion atomically increments quiz count', async () => {
  const { service, getCount } = createService(2);

  assert.deepEqual(await service.recordCompletion('user-1'), { quizCompletedCount: 3 });
  assert.equal(getCount(), 3);
});

test('getMe returns current quiz count', async () => {
  const { service } = createService(4);

  assert.deepEqual(await service.getMe('user-1'), { quizCompletedCount: 4 });
});

test('getMe rejects missing user', async () => {
  const { service } = createService();

  await assert.rejects(() => service.getMe('missing'), NotFoundException);
});
