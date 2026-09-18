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
        args.where.id === 'missing' ? null : { quizCompletedCount, quizResults: [] },
    },
    quizResult: {
      create: async () => ({}),
    },
    $transaction: async (fn: any) => fn(prisma),
  };

  return { service: new QuizService(prisma as any), getCount: () => quizCompletedCount };
}

test('recordCompletion atomically increments quiz count', async () => {
  const { service, getCount } = createService(2);

  assert.deepEqual(await service.recordCompletion('user-1'), { quizCompletedCount: 3 });
  assert.equal(getCount(), 3);
});

test('recordCompletion saves quiz result payload when present', async () => {
  let createdResult: any;
  const prisma: any = {
    user: {
      update: async () => ({ quizCompletedCount: 1 }),
      findUnique: async () => ({ quizCompletedCount: 1, quizResults: [] }),
    },
    quizResult: {
      create: async (args: any) => {
        createdResult = args.data;
        return createdResult;
      },
    },
    $transaction: async (fn: any) => fn(prisma),
  };
  const service = new QuizService(prisma);

  assert.deepEqual(
    await service.recordCompletion('user-1', {
      profileId: 'cozy-plant-corner',
      profileTitle: 'Cozy Plant Corner',
      variant: 'woman',
      score: 91.4,
      dna: 'CP-0001-0002',
      chips: ['quiet'],
      answers: [{ id: 'a' }],
    }),
    { quizCompletedCount: 1 },
  );
  assert.deepEqual(createdResult, {
    user: { connect: { id: 'user-1' } },
    profileId: 'cozy-plant-corner',
    profileTitle: 'Cozy Plant Corner',
    variant: 'woman',
    score: 91,
    dna: 'CP-0001-0002',
    chips: ['quiet'],
    answers: [{ id: 'a' }],
  });
});

test('getMe returns current quiz count', async () => {
  const { service } = createService(4);

  assert.deepEqual(await service.getMe('user-1'), { quizCompletedCount: 4, results: [] });
});

test('getMe rejects missing user', async () => {
  const { service } = createService();

  await assert.rejects(() => service.getMe('missing'), NotFoundException);
});
