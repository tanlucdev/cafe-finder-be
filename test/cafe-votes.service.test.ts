import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { Prisma } from '@prisma/client';
import { CafeVotesService } from '../src/cafes/cafe-votes.service';

function createService(overrides: any = {}) {
  const votes: any[] = [];
  const published = new Set(overrides.published ?? ['cafe-1', 'cafe-2']);
  const prisma = {
    cafe: {
      findFirst: async ({ where }: any) =>
        published.has(where.id) && where.isPublished ? { id: where.id } : null,
    },
    cafeVote: {
      create: async ({ data }: any) => {
        if (votes.some((vote) => vote.userId === data.userId && vote.cafeId === data.cafeId)) {
          throw new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
            code: 'P2002',
            clientVersion: 'test',
          } as any);
        }
        votes.push({ ...data, createdAt: new Date() });
        return data;
      },
      count: async ({ where }: any) => votes.filter((vote) => vote.cafeId === where.cafeId).length,
      deleteMany: async ({ where }: any) => {
        const startLength = votes.length;
        for (let index = votes.length - 1; index >= 0; index -= 1) {
          if (votes[index].userId === where.userId && votes[index].cafeId === where.cafeId) {
            votes.splice(index, 1);
          }
        }
        return { count: startLength - votes.length };
      },
      findMany: async ({ where }: any) =>
        votes
          .filter((vote) => vote.userId === where.userId)
          .map((vote) => ({ cafeId: vote.cafeId })),
    },
    ...overrides.prisma,
  };

  return { service: new CafeVotesService(prisma as any), votes, prisma };
}

test('vote creates a cafe vote', async () => {
  const { service, votes } = createService();

  assert.deepEqual(await service.vote('user-1', 'cafe-1'), {
    cafeId: 'cafe-1',
    weeklyVoteCount: 1,
    voteCount: 1,
    voted: true,
  });
  assert.equal(votes.length, 1);
});

test('duplicate vote for same cafe is idempotent', async () => {
  const { service, votes } = createService();

  await service.vote('user-1', 'cafe-1');
  assert.deepEqual(await service.vote('user-1', 'cafe-1'), {
    cafeId: 'cafe-1',
    weeklyVoteCount: 1,
    voteCount: 1,
    voted: true,
  });
  assert.equal(votes.length, 1);
});

test('same user can vote multiple cafes', async () => {
  const { service, votes } = createService();

  await service.vote('user-1', 'cafe-1');
  await service.vote('user-1', 'cafe-2');

  assert.deepEqual(votes.map((vote) => vote.cafeId).sort(), ['cafe-1', 'cafe-2']);
});

test('unvote removes current user cafe vote', async () => {
  const { service, votes } = createService();

  await service.vote('user-1', 'cafe-1');
  assert.deepEqual(await service.unvote('user-1', 'cafe-1'), {
    cafeId: 'cafe-1',
    weeklyVoteCount: 0,
    voteCount: 0,
    voted: false,
  });
  assert.equal(votes.length, 0);
});

test('missing or unpublished cafe fails', async () => {
  const { service } = createService({ published: [] });

  await assert.rejects(() => service.vote('user-1', 'cafe-1'), /Cafe not found/);
});

test('my votes returns voted cafe ids', async () => {
  const { service } = createService();

  await service.vote('user-1', 'cafe-1');
  await service.vote('user-1', 'cafe-2');

  assert.deepEqual(await service.getMyVotes('user-1'), ['cafe-1', 'cafe-2']);
});

test('weekRange returns previous completed Vietnam Monday-Sunday', () => {
  const range = CafeVotesService.weekRange(new Date('2026-07-11T05:00:00.000Z'));

  assert.equal(range.start.toISOString(), '2026-06-28T17:00:00.000Z');
  assert.equal(range.end.toISOString(), '2026-07-05T17:00:00.000Z');
});
