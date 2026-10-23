import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { AdminVotesService } from '../src/admin/votes/admin-votes.service';

test('AdminVotesService filters and serializes vote events', async () => {
  const calls: any[] = [];
  const prisma = {
    cafeVoteEvent: {
      findMany: async (args: any) => {
        calls.push(args);
        return [
          {
            id: 'event-1',
            action: 'VOTE',
            cafeId: 'cafe-1',
            userId: 'user-1',
            createdAt: new Date('2026-10-13T17:01:00.000Z'),
            cafe: { id: 'cafe-1', name: 'Cafe Mot', slug: 'cafe-mot' },
            user: { displayName: null, email: 'member@example.com' },
          },
        ];
      },
      count: async () => 1,
    },
  };
  const result = await new AdminVotesService(prisma as any).list(
    'VOTE',
    'Mot',
    '2026-10-14',
    2,
    20,
  );

  assert.deepEqual(result.data[0], {
    id: 'event-1',
    action: 'VOTE',
    cafeId: 'cafe-1',
    userId: 'user-1',
    createdAt: new Date('2026-10-13T17:01:00.000Z'),
    cafe: { id: 'cafe-1', name: 'Cafe Mot', slug: 'cafe-mot' },
    author_name: 'm***@example.com',
  });
  assert.equal(calls[0].where.action, 'VOTE');
  assert.deepEqual(calls[0].where.createdAt, {
    gte: new Date('2026-10-13T17:00:00.000Z'),
    lt: new Date('2026-10-14T17:00:00.000Z'),
  });
  assert.equal(calls[0].skip, 20);
});

test('AdminVotesService rejects invalid filter values', async () => {
  const service = new AdminVotesService({} as any);
  await assert.rejects(() => service.list('OTHER'), /action must be VOTE or UNVOTE/);
  await assert.rejects(
    () => service.list(undefined, undefined, '2026-02-30'),
    /valid calendar date/,
  );
});
