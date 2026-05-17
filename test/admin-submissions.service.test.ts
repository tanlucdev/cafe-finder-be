import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { NotFoundException } from '@nestjs/common';
import { AdminSubmissionsService } from '../src/admin/submissions/admin-submissions.service';

function createService(overrides: any = {}) {
  const prisma = {
    cafeSubmission: {
      findMany: async () => [],
      findUnique: async () => ({
        id: 'submission-1',
        name: 'Quán Mới',
        address: 'District 1',
        googleMapsUrl: 'https://maps.test',
      }),
      update: async ({ data }: any) => ({ id: 'submission-1', ...data }),
    },
    cafe: {
      create: async ({ data }: any) => ({ id: 'cafe-1', ...data }),
    },
    ...overrides.prisma,
  };

  return {
    service: new AdminSubmissionsService(prisma as any),
    prisma,
  };
}

test('listSubmissions applies optional status filter', async () => {
  let findManyArgs: any;
  const { service } = createService({
    prisma: {
      cafeSubmission: {
        findMany: async (args: any) => {
          findManyArgs = args;
          return [];
        },
      },
    },
  });

  await service.listSubmissions('pending');

  assert.deepEqual(findManyArgs.where, { status: 'pending' });
  assert.deepEqual(findManyArgs.include.submittedBy.select, {
    id: true,
    email: true,
    displayName: true,
  });
});

test('getSubmission throws when missing', async () => {
  const { service } = createService({
    prisma: { cafeSubmission: { findUnique: async () => null } },
  });

  await assert.rejects(() => service.getSubmission('missing'), NotFoundException);
});

test('approveSubmission marks submission approved and creates unpublished draft cafe', async () => {
  let submissionUpdate: any;
  let cafeCreate: any;
  const { service } = createService({
    prisma: {
      cafeSubmission: {
        findUnique: async () => ({
          id: 'submission-1',
          name: 'Quán Mới',
          address: 'District 1',
          googleMapsUrl: 'https://maps.test',
        }),
        update: async (args: any) => {
          submissionUpdate = args;
          return { id: args.where.id, ...args.data };
        },
      },
      cafe: {
        create: async (args: any) => {
          cafeCreate = args;
          return { id: 'cafe-1', ...args.data };
        },
      },
    },
  });

  const result = await service.approveSubmission('submission-1');

  assert.deepEqual(submissionUpdate.data, { status: 'approved' });
  assert.equal(cafeCreate.data.slug, 'quan-moi');
  assert.equal(cafeCreate.data.isPublished, false);
  assert.equal(result.cafe.isPublished, false);
});

test('approveSubmission stores an optional admin review note without changing submission note', async () => {
  let submissionUpdate: any;
  const { service } = createService({
    prisma: {
      cafeSubmission: {
        findUnique: async () => ({
          id: 'submission-1',
          name: 'Quán Mới',
          address: 'District 1',
          googleMapsUrl: 'https://maps.test',
          note: 'User submitted note',
        }),
        update: async (args: any) => {
          submissionUpdate = args;
          return { id: args.where.id, ...args.data };
        },
      },
      cafe: {
        create: async ({ data }: any) => ({ id: 'cafe-1', ...data }),
      },
    },
  });

  await service.approveSubmission('submission-1', '  Looks good  ');

  assert.deepEqual(submissionUpdate.data, { status: 'approved', reviewNote: 'Looks good' });
});

test('rejectSubmission only marks submission rejected', async () => {
  let updateArgs: any;
  const { service } = createService({
    prisma: {
      cafeSubmission: {
        findUnique: async () => ({ id: 'submission-1', name: 'Quán Mới' }),
        update: async (args: any) => {
          updateArgs = args;
          return { id: args.where.id, ...args.data };
        },
      },
    },
  });

  const result = await service.rejectSubmission('submission-1');

  assert.deepEqual(updateArgs.data, { status: 'rejected' });
  assert.equal(result.status, 'rejected');
});

test('rejectSubmission stores an optional admin review note', async () => {
  let updateArgs: any;
  const { service } = createService({
    prisma: {
      cafeSubmission: {
        findUnique: async () => ({ id: 'submission-1', name: 'Quán Mới' }),
        update: async (args: any) => {
          updateArgs = args;
          return { id: args.where.id, ...args.data };
        },
      },
    },
  });

  const result = await service.rejectSubmission('submission-1', 'Address is incomplete');

  assert.deepEqual(updateArgs.data, { status: 'rejected', reviewNote: 'Address is incomplete' });
  assert.equal(result.reviewNote, 'Address is incomplete');
});
