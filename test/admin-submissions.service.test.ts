import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { AdminSubmissionsService } from '../src/admin/submissions/admin-submissions.service';

function createService(overrides: any = {}) {
  const prisma = {
    cafeSubmission: {
      findMany: async () => [],
      count: async () => 0,
      findUnique: async () => ({
        id: 'submission-1',
        name: 'Quán Mới',
        address: 'District 1',
        googleMapsUrl: 'https://maps.test',
        status: 'pending',
        isHidden: false,
      }),
      update: async ({ data }: any) => ({ id: 'submission-1', ...data }),
      updateMany: async () => ({ count: 1 }),
    },
    cafe: {
      create: async ({ data }: any) => ({ id: 'cafe-1', ...data }),
    },
    $transaction: async (fn: any) => fn(prisma),
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
        count: async () => 0,
      },
    },
  });

  await service.listSubmissions('pending');

  assert.deepEqual(findManyArgs.where, { isHidden: false, status: 'pending' });
  assert.deepEqual(findManyArgs.include.submittedBy.select, {
    id: true,
    email: true,
    displayName: true,
  });
  assert.deepEqual(findManyArgs.include.createdCafe.select, {
    id: true,
    name: true,
    slug: true,
    isPublished: true,
  });
});

test('listSubmissions excludes drafts by default', async () => {
  let countArgs: any;
  const { service } = createService({
    prisma: {
      cafeSubmission: {
        findMany: async () => [],
        count: async (args: any) => {
          countArgs = args;
          return 0;
        },
      },
    },
  });

  await service.listSubmissions();

  assert.deepEqual(countArgs.where, {
    isHidden: false,
    status: { in: ['pending', 'approved', 'rejected'] },
  });
});

test('getSubmission throws when missing', async () => {
  const { service } = createService({
    prisma: { cafeSubmission: { findUnique: async () => null } },
  });

  await assert.rejects(() => service.getSubmission('missing'), NotFoundException);
});

test('getSubmission throws when hidden', async () => {
  const { service } = createService({
    prisma: {
      cafeSubmission: { findUnique: async () => ({ id: 'submission-1', isHidden: true }) },
    },
  });

  await assert.rejects(() => service.getSubmission('submission-1'), NotFoundException);
});

test('getSubmission throws when draft', async () => {
  const { service } = createService({
    prisma: {
      cafeSubmission: {
        findUnique: async () => ({ id: 'submission-1', isHidden: false, status: 'draft' }),
      },
    },
  });

  await assert.rejects(() => service.getSubmission('submission-1'), NotFoundException);
});

test('approveSubmission throws not found when submission is hidden', async () => {
  const { service } = createService({
    prisma: {
      cafeSubmission: {
        findUnique: async () => ({ id: 'submission-1', isHidden: true, status: 'pending' }),
      },
    },
  });

  await assert.rejects(() => service.approveSubmission('submission-1'), NotFoundException);
});

test('approveSubmission throws conflict when already reviewed', async () => {
  const { service } = createService({
    prisma: {
      cafeSubmission: {
        findUnique: async () => ({ id: 'submission-1', isHidden: false, status: 'approved' }),
      },
    },
  });

  await assert.rejects(() => service.approveSubmission('submission-1'), ConflictException);
});

test('approveSubmission throws conflict when draft', async () => {
  const { service } = createService({
    prisma: {
      cafeSubmission: {
        findUnique: async () => ({ id: 'submission-1', isHidden: false, status: 'draft' }),
      },
    },
  });

  await assert.rejects(() => service.approveSubmission('submission-1'), ConflictException);
});

test('approveSubmission does not create a duplicate cafe when claim fails', async () => {
  let cafeCreateCount = 0;
  const { service } = createService({
    prisma: {
      cafeSubmission: {
        findUnique: async () => ({
          id: 'submission-1',
          name: 'Quán Mới',
          status: 'pending',
          isHidden: false,
        }),
      },
      cafe: {
        create: async () => {
          cafeCreateCount += 1;
          return { id: 'cafe-1' };
        },
      },
      $transaction: async (fn: any) =>
        fn({
          cafeSubmission: {
            updateMany: async () => ({ count: 0 }),
            findUnique: async () => ({ id: 'submission-1', status: 'approved', isHidden: false }),
          },
          cafe: {
            create: async () => {
              cafeCreateCount += 1;
              return { id: 'cafe-1' };
            },
          },
        }),
    },
  });

  await assert.rejects(() => service.approveSubmission('submission-1'), ConflictException);
  assert.equal(cafeCreateCount, 0);
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
          status: 'pending',
          isHidden: false,
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
      $transaction: async (fn: any) =>
        fn({
          cafeSubmission: {
            updateMany: async () => ({ count: 1 }),
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
        }),
    },
  });

  const result = await service.approveSubmission('submission-1');

  assert.deepEqual(submissionUpdate.data, { status: 'approved', createdCafeId: 'cafe-1' });
  assert.equal(cafeCreate.data.slug, 'quan-moi');
  assert.equal(cafeCreate.data.isPublished, false);
  assert.equal(result.cafe.isPublished, false);
});

test('approveSubmission maps payload into unpublished cafe draft', async () => {
  let cafeCreate: any;
  const { service } = createService({
    prisma: {
      cafeSubmission: {
        findUnique: async () => ({
          id: 'submission-1',
          submissionType: 'owner',
          name: 'Fallback',
          status: 'pending',
          isHidden: false,
          payload: {
            name: 'Quán Payload',
            address: '1 Nguyen Hue',
            district: 'Quận 1',
            googleMapsUrl: 'https://maps.test/payload',
            openingTime: '07:30',
            closingTime: '22:00',
            priceMin: 45000,
            priceMax: 90000,
            oneLiner: 'Rooftop nhẹ nhàng',
            description: 'Nhiều ánh sáng.',
            vibes: ['yên tĩnh'],
            purposes: ['làm việc'],
            amenities: ['wifi'],
            tags: ['rooftop'],
            images: ['cover.webp'],
            imageOrientations: ['landscape'],
            menuImages: ['menu.webp'],
            parkingLocation: 'Trước quán',
            signatureDrink: 'Cold brew',
            instagramUrl: 'https://instagram.com/cafe',
          },
        }),
        update: async (args: any) => ({ id: args.where.id, ...args.data }),
      },
      cafe: {
        create: async (args: any) => {
          cafeCreate = args;
          return { id: 'cafe-1', ...args.data };
        },
      },
      $transaction: async (fn: any) =>
        fn({
          cafeSubmission: {
            updateMany: async () => ({ count: 1 }),
            update: async (args: any) => ({ id: args.where.id, ...args.data }),
          },
          cafe: {
            create: async (args: any) => {
              cafeCreate = args;
              return { id: 'cafe-1', ...args.data };
            },
          },
          $executeRaw: async () => undefined,
        }),
    },
  });

  await service.approveSubmission('submission-1');

  assert.equal(cafeCreate.data.name, 'Quán Payload');
  assert.equal(cafeCreate.data.slug, 'quan-payload');
  assert.equal(cafeCreate.data.openingTime.toISOString(), '1970-01-01T07:30:00.000Z');
  assert.equal(cafeCreate.data.closingTime.toISOString(), '1970-01-01T22:00:00.000Z');
  assert.equal(cafeCreate.data.priceMin, 45000);
  assert.equal(cafeCreate.data.priceMax, 90000);
  assert.equal(cafeCreate.data.coverImage, 'cover.webp');
  assert.deepEqual(cafeCreate.data.images, ['cover.webp']);
  assert.deepEqual(cafeCreate.data.imageOrientations, ['landscape']);
  assert.deepEqual(cafeCreate.data.menuImages, ['menu.webp']);
  assert.equal(cafeCreate.data.menuImage, 'menu.webp');
  assert.deepEqual(cafeCreate.data.vibes, ['yên tĩnh']);
  assert.deepEqual(cafeCreate.data.purposes, ['làm việc']);
  assert.deepEqual(cafeCreate.data.amenities, ['wifi']);
  assert.deepEqual(cafeCreate.data.tags, ['rooftop']);
  assert.equal(cafeCreate.data.parkingLocation, 'Trước quán');
  assert.equal(cafeCreate.data.signatureDrink, 'Cold brew');
  assert.equal(cafeCreate.data.instagramUrl, 'https://instagram.com/cafe');
  assert.equal(cafeCreate.data.isPublished, false);
});

test('approveSubmission omits invalid owner times', async () => {
  let cafeCreate: any;
  const { service } = createService({
    prisma: {
      cafeSubmission: {
        findUnique: async () => ({
          id: 'submission-1',
          submissionType: 'owner',
          name: 'Bad Time',
          status: 'pending',
          isHidden: false,
          payload: {
            name: 'Bad Time',
            openingTime: '24:00',
            closingTime: '22:60',
            images: ['cover.webp'],
          },
        }),
      },
      cafe: {
        create: async (args: any) => {
          cafeCreate = args;
          return { id: 'cafe-1', ...args.data };
        },
      },
      $transaction: async (fn: any) =>
        fn({
          cafeSubmission: {
            updateMany: async () => ({ count: 1 }),
            update: async (args: any) => ({ id: args.where.id, ...args.data }),
          },
          cafe: {
            create: async (args: any) => {
              cafeCreate = args;
              return { id: 'cafe-1', ...args.data };
            },
          },
        }),
    },
  });

  await service.approveSubmission('submission-1');

  assert.equal(cafeCreate.data.openingTime, undefined);
  assert.equal(cafeCreate.data.closingTime, undefined);
});

test('approveSubmission copies community images but ignores owner-only payload fields', async () => {
  let cafeCreate: any;
  const { service } = createService({
    prisma: {
      cafeSubmission: {
        findUnique: async () => ({
          id: 'submission-1',
          submissionType: 'community',
          name: 'Community Cafe',
          address: 'District 3',
          googleMapsUrl: 'https://maps.test/community',
          note: 'Nice alley',
          status: 'pending',
          isHidden: false,
          payload: {
            images: ['owner.webp'],
            openingTime: '06:00',
            priceMin: 1,
            tags: ['owner-only'],
          },
        }),
        update: async (args: any) => ({ id: args.where.id, ...args.data }),
      },
      cafe: {
        create: async (args: any) => {
          cafeCreate = args;
          return { id: 'cafe-1', ...args.data };
        },
      },
      $transaction: async (fn: any) =>
        fn({
          cafeSubmission: {
            updateMany: async () => ({ count: 1 }),
            update: async (args: any) => ({ id: args.where.id, ...args.data }),
          },
          cafe: {
            create: async (args: any) => {
              cafeCreate = args;
              return { id: 'cafe-1', ...args.data };
            },
          },
        }),
    },
  });

  await service.approveSubmission('submission-1');

  assert.equal(cafeCreate.data.name, 'Community Cafe');
  assert.deepEqual(cafeCreate.data.images, ['owner.webp']);
  assert.deepEqual(cafeCreate.data.imageOrientations, []);
  assert.equal(cafeCreate.data.coverImage, 'owner.webp');
  assert.deepEqual(cafeCreate.data.coverImageCrop, { x: 50, y: 50 });
  assert.deepEqual(cafeCreate.data.tags, []);
  assert.equal(cafeCreate.data.openingTime, undefined);
  assert.equal(cafeCreate.data.priceMin, undefined);
  assert.equal(cafeCreate.data.isPublished, false);
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
          status: 'pending',
          isHidden: false,
        }),
        update: async (args: any) => {
          submissionUpdate = args;
          return { id: args.where.id, ...args.data };
        },
      },
      cafe: {
        create: async ({ data }: any) => ({ id: 'cafe-1', ...data }),
      },
      $transaction: async (fn: any) =>
        fn({
          cafeSubmission: {
            updateMany: async () => ({ count: 1 }),
            update: async (args: any) => {
              submissionUpdate = args;
              return { id: args.where.id, ...args.data };
            },
          },
          cafe: {
            create: async ({ data }: any) => ({ id: 'cafe-1', ...data }),
          },
        }),
    },
  });

  await service.approveSubmission('submission-1', '  Looks good  ');

  assert.deepEqual(submissionUpdate.data, {
    status: 'approved',
    createdCafeId: 'cafe-1',
    reviewNote: 'Looks good',
  });
});

test('rejectSubmission only marks submission rejected', async () => {
  let updateArgs: any;
  const { service } = createService({
    prisma: {
      cafeSubmission: {
        findUnique: async () => ({
          id: 'submission-1',
          name: 'Quán Mới',
          status: 'pending',
          isHidden: false,
        }),
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
        findUnique: async () => ({
          id: 'submission-1',
          name: 'Quán Mới',
          status: 'pending',
          isHidden: false,
        }),
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

test('rejectSubmission rejects non-pending submissions', async () => {
  const { service } = createService({
    prisma: {
      cafeSubmission: {
        findUnique: async () => ({ id: 'submission-1', status: 'approved', isHidden: false }),
      },
    },
  });

  await assert.rejects(() => service.rejectSubmission('submission-1'), ConflictException);
});

test('hideSubmission soft hides visible submission', async () => {
  let updateArgs: any;
  const { service } = createService({
    prisma: {
      cafeSubmission: {
        findUnique: async () => ({ id: 'submission-1', isHidden: false }),
        update: async (args: any) => {
          updateArgs = args;
          return { id: args.where.id, ...args.data };
        },
      },
    },
  });

  const result = await service.hideSubmission('submission-1');

  assert.deepEqual(updateArgs.data, { isHidden: true });
  assert.equal(result.isHidden, true);
});
