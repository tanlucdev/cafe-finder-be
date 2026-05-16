import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AdminCafesService } from '../src/admin/cafes/admin-cafes.service';

function createService(overrides: any = {}) {
  const prisma = {
    cafe: {
      findMany: async () => [],
      count: async () => 0,
      findUnique: async () => ({ id: 'cafe-1', images: [], imageOrientations: [], coverImage: null }),
      create: async ({ data }: any) => ({ id: 'cafe-1', ...data }),
      update: async ({ data }: any) => ({ id: 'cafe-1', ...data }),
      delete: async ({ where }: any) => ({ id: where.id }),
    },
    $executeRaw: async () => undefined,
    ...overrides.prisma,
  };
  const storage = {
    uploadImage: async () => 'https://cdn.test/cafe.webp',
    deleteImage: async () => undefined,
    ...overrides.storage,
  };

  return {
    service: new AdminCafesService(prisma as any, storage as any),
    prisma,
    storage,
  };
}

test('listCafes applies admin filters and pagination', async () => {
  let findManyArgs: any;
  let countArgs: any;
  const { service } = createService({
    prisma: {
      cafe: {
        findMany: async (args: any) => {
          findManyArgs = args;
          return [{ id: 'cafe-1' }];
        },
        count: async (args: any) => {
          countArgs = args;
          return 25;
        },
      },
    },
  });

  const result = await service.listCafes({
    district: 'District 1',
    is_published: false,
    is_featured: true,
    search: 'workshop',
    page: 2,
    limit: 10,
  });

  assert.equal(findManyArgs.skip, 10);
  assert.equal(findManyArgs.take, 10);
  assert.deepEqual(findManyArgs.where.district, 'District 1');
  assert.equal(findManyArgs.where.isPublished, false);
  assert.equal(findManyArgs.where.isFeatured, true);
  assert.equal(findManyArgs.where.OR.length, 3);
  assert.deepEqual(countArgs, { where: findManyArgs.where });
  assert.deepEqual(result.meta, { total: 25, page: 2, limit: 10, totalPages: 3 });
});

test('getCafe throws when cafe does not exist', async () => {
  const { service } = createService({
    prisma: { cafe: { findUnique: async () => null } },
  });

  await assert.rejects(() => service.getCafe('missing'), NotFoundException);
});

test('createCafe generates slug and updates PostGIS location when lat/lng are present', async () => {
  let createdData: any;
  let rawCalled = false;
  const { service } = createService({
    prisma: {
      cafe: {
        create: async ({ data }: any) => {
          createdData = data;
          return { id: 'cafe-1', ...data };
        },
      },
      $executeRaw: async () => {
        rawCalled = true;
      },
    },
  });

  const result = await service.createCafe({ name: 'Cà Phê Sáng', lat: 10.1, lng: 106.2 });

  assert.equal(createdData.slug, 'ca-phe-sang');
  assert.equal(result.slug, 'ca-phe-sang');
  assert.equal(rawCalled, true);
});

test('updateCafe regenerates slug from name unless slug is provided', async () => {
  let updateArgs: any;
  const { service } = createService({
    prisma: {
      cafe: {
        findUnique: async () => ({ id: 'cafe-1', images: [], imageOrientations: [] }),
        update: async (args: any) => {
          updateArgs = args;
          return { id: 'cafe-1', ...args.data };
        },
      },
    },
  });

  await service.updateCafe('cafe-1', { name: 'Cafe Moi' });
  assert.equal(updateArgs.data.slug, 'cafe-moi');

  await service.updateCafe('cafe-1', { name: 'Cafe Moi', slug: 'custom-slug' });
  assert.equal(updateArgs.data.slug, 'custom-slug');
});

test('togglePublish and toggleFeature update the expected fields', async () => {
  const updates: any[] = [];
  const { service } = createService({
    prisma: {
      cafe: {
        findUnique: async () => ({ id: 'cafe-1', isPublished: false, isFeatured: false, images: [] }),
        update: async (args: any) => {
          updates.push(args);
          return { id: args.where.id, ...args.data };
        },
      },
    },
  });

  await service.togglePublish('cafe-1');
  await service.toggleFeature('cafe-1', 2);

  assert.deepEqual(updates[0].data, { isPublished: true });
  assert.deepEqual(updates[1].data, { isFeatured: true, featuredOrder: 2 });
});

test('uploadCafeImage appends image and sets cover image when empty', async () => {
  let uploadFolder = '';
  let updateData: any;
  const { service } = createService({
    prisma: {
      cafe: {
        findUnique: async () => ({
          id: 'cafe-1',
          images: ['https://cdn.test/old.webp'],
          imageOrientations: ['landscape'],
          coverImage: null,
        }),
        update: async ({ data }: any) => {
          updateData = data;
          return data;
        },
      },
    },
    storage: {
      uploadImage: async (_file: any, folder: string) => {
        uploadFolder = folder;
        return 'https://cdn.test/new.webp';
      },
    },
  });

  const result = await service.uploadCafeImage('cafe-1', { originalname: 'new.webp' } as any);

  assert.equal(uploadFolder, 'cafes/cafe-1');
  assert.deepEqual(updateData.images, ['https://cdn.test/old.webp', 'https://cdn.test/new.webp']);
  assert.deepEqual(updateData.imageOrientations, ['landscape', 'unknown']);
  assert.equal(result.coverImage, 'https://cdn.test/new.webp');
});

test('deleteCafeImage deletes storage object and updates images, orientations, cover', async () => {
  let deletedUrl = '';
  let updateData: any;
  const { service } = createService({
    prisma: {
      cafe: {
        findUnique: async () => ({
          id: 'cafe-1',
          images: ['https://cdn.test/a.webp', 'https://cdn.test/b.webp'],
          imageOrientations: ['landscape', 'portrait'],
          coverImage: 'https://cdn.test/a.webp',
        }),
        update: async ({ data }: any) => {
          updateData = data;
          return data;
        },
      },
    },
    storage: {
      deleteImage: async (url: string) => {
        deletedUrl = url;
      },
    },
  });

  await service.deleteCafeImage('cafe-1', 'https://cdn.test/a.webp');

  assert.equal(deletedUrl, 'https://cdn.test/a.webp');
  assert.deepEqual(updateData.images, ['https://cdn.test/b.webp']);
  assert.deepEqual(updateData.imageOrientations, ['portrait']);
  assert.equal(updateData.coverImage, 'https://cdn.test/b.webp');
});

test('deleteCafeImage rejects URLs that do not belong to the cafe', async () => {
  const { service } = createService({
    prisma: {
      cafe: {
        findUnique: async () => ({
          id: 'cafe-1',
          images: ['https://cdn.test/a.webp'],
          imageOrientations: ['landscape'],
        }),
      },
    },
  });

  await assert.rejects(
    () => service.deleteCafeImage('cafe-1', 'https://cdn.test/missing.webp'),
    BadRequestException,
  );
});
