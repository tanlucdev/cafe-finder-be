import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { AdminCafesService } from '../src/admin/cafes/admin-cafes.service';
import { CreateCafeDto } from '../src/admin/cafes/dto/create-cafe.dto';
import { ToggleFeatureDto } from '../src/admin/cafes/dto/toggle-feature.dto';
import { UpdateCafeDto } from '../src/admin/cafes/dto/update-cafe.dto';

function createService(overrides: any = {}) {
  const prisma = {
    cafe: {
      findMany: async () => [],
      count: async () => 0,
      findUnique: async () => ({
        id: 'cafe-1',
        images: [],
        imageOrientations: [],
        coverImage: null,
      }),
      create: async ({ data }: any) => ({ id: 'cafe-1', ...data }),
      update: async ({ data }: any) => ({ id: 'cafe-1', ...data }),
      delete: async ({ where }: any) => ({ id: where.id }),
    },
    $executeRaw: async () => undefined,
    ...overrides.prisma,
  };
  const storage = {
    uploadImage: async () => 'https://cdn.test/cafe.webp',
    uploadImageFromUrl: async () => 'https://cdn.test/imported.webp',
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
  assert.deepEqual(findManyArgs.where.AND[0], {
    OR: [{ district: 'District 1' }, { districtEn: 'District 1' }],
  });
  assert.equal(findManyArgs.where.isPublished, false);
  assert.equal(findManyArgs.where.isFeatured, true);
  assert.equal(findManyArgs.where.AND[1].OR.length, 6);
  assert.equal(findManyArgs.select.parkingLocation, true);
  assert.equal(findManyArgs.select.parkingLocationEn, true);
  assert.equal(findManyArgs.select.vibesEn, true);
  assert.equal(findManyArgs.select.purposesEn, true);
  assert.equal(findManyArgs.select.amenities, true);
  assert.equal(findManyArgs.select.amenitiesEn, true);
  assert.equal(findManyArgs.select.tags, true);
  assert.equal(findManyArgs.select.tagsEn, true);
  assert.deepEqual(countArgs, { where: findManyArgs.where });
  assert.deepEqual(result.meta, { total: 25, page: 2, limit: 10, totalPages: 3 });
});

test('getCafe throws when cafe does not exist', async () => {
  const { service } = createService({
    prisma: { cafe: { findUnique: async () => null } },
  });

  await assert.rejects(() => service.getCafe('missing'), NotFoundException);
});

test('CreateCafeDto parses CMS boolean strings without forcing featured on', () => {
  const dto = plainToInstance(
    CreateCafeDto,
    { name: 'Cafe mới', isFeatured: 'false', isPublished: 'false' },
    { enableImplicitConversion: true },
  );

  assert.deepEqual(validateSync(dto), []);
  assert.equal(dto.isFeatured, false);
  assert.equal(dto.isPublished, false);
});

test('UpdateCafeDto accepts menuImage with whitelist validation', () => {
  const dto = plainToInstance(UpdateCafeDto, { menuImage: 'https://cdn.test/menu.webp' });

  assert.deepEqual(validateSync(dto, { whitelist: true, forbidNonWhitelisted: true }), []);
});

test('UpdateCafeDto accepts cafe tags with whitelist validation', () => {
  const dto = plainToInstance(UpdateCafeDto, {
    tags: ['ngoài trời', 'view đẹp'],
    tagsEn: ['outdoor', 'nice view'],
  });

  assert.deepEqual(validateSync(dto, { whitelist: true, forbidNonWhitelisted: true }), []);
});

test('cafe featuredOrder treats zero as optional', () => {
  const updateDto = plainToInstance(UpdateCafeDto, { featuredOrder: 0 });
  const toggleDto = plainToInstance(ToggleFeatureDto, { featuredOrder: '0' });

  assert.deepEqual(validateSync(updateDto), []);
  assert.deepEqual(validateSync(toggleDto), []);
  assert.equal(updateDto.featuredOrder, null);
  assert.equal(toggleDto.featuredOrder, null);
});

test('createCafe generates slug, persists parkingLocation, and updates PostGIS location', async () => {
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

  const result = await service.createCafe({
    name: 'Cà Phê Sáng',
    lat: 10.1,
    lng: 106.2,
    parkingLocation: 'Hầm giữ xe dưới tòa nhà',
  });

  assert.equal(createdData.slug, 'ca-phe-sang');
  assert.equal(createdData.parkingLocation, 'Hầm giữ xe dưới tòa nhà');
  assert.equal(result.slug, 'ca-phe-sang');
  assert.equal(rawCalled, true);
});

test('createCafe clears featured order when cafe is not featured', async () => {
  let createdData: any;
  const { service } = createService({
    prisma: {
      cafe: {
        create: async ({ data }: any) => {
          createdData = data;
          return { id: 'cafe-1', ...data };
        },
      },
    },
  });

  await service.createCafe({ name: 'Cafe thường', isFeatured: false, featuredOrder: 3 });

  assert.equal(createdData.isFeatured, false);
  assert.equal(createdData.featuredOrder, null);
});

test('createCafe maps Vietnamese array fields to English arrays when omitted', async () => {
  let createdData: any;
  const { service } = createService({
    prisma: {
      cafe: {
        create: async ({ data }: any) => {
          createdData = data;
          return { id: 'cafe-1', ...data };
        },
      },
    },
  });

  await service.createCafe({
    name: 'Cafe vibe',
    vibes: ['yên tĩnh'],
    purposes: ['làm việc'],
    amenities: ['WiFi'],
    tags: ['ngoài trời'],
  });

  assert.deepEqual(createdData.vibesEn, ['quiet']);
  assert.deepEqual(createdData.purposesEn, ['work']);
  assert.deepEqual(createdData.amenitiesEn, ['WiFi']);
  assert.deepEqual(createdData.tagsEn, ['outdoor']);
});

test('updateCafe remaps empty localized arrays from Vietnamese fields', async () => {
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

  await service.updateCafe('cafe-1', {
    tags: ['view đẹp'],
    tagsEn: [],
    vibes: ['hiện đại'],
    vibesEn: [],
  });

  assert.deepEqual(updateArgs.data.tagsEn, ['nice view']);
  assert.deepEqual(updateArgs.data.vibesEn, ['modern']);
});

test('updateCafe regenerates slug from name unless slug is provided and updates parkingLocation', async () => {
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

  await service.updateCafe('cafe-1', { parkingLocation: 'Gửi xe trước quán' });
  assert.equal(updateArgs.data.parkingLocation, 'Gửi xe trước quán');
});

test('updateCafe keeps localized arrays in sync for CMS updates', async () => {
  let updateData: any;
  const { service } = createService({
    prisma: {
      cafe: {
        findUnique: async () => ({ id: 'cafe-1', images: [], imageOrientations: [] }),
        update: async ({ data }: any) => {
          updateData = data;
          return { id: 'cafe-1', ...data };
        },
      },
    },
  });

  await service.updateCafe('cafe-1', { vibes: ['yên tĩnh'] });
  assert.deepEqual(updateData.vibes, ['yên tĩnh']);
  assert.deepEqual(updateData.vibesEn, ['quiet']);

  await service.updateCafe('cafe-1', { vibes: ['yên tĩnh'], vibesEn: ['Quiet'] });
  assert.deepEqual(updateData.vibesEn, ['Quiet']);

  await service.updateCafe('cafe-1', { tags: ['ngoài trời'] });
  assert.deepEqual(updateData.tags, ['ngoài trời']);
  assert.deepEqual(updateData.tagsEn, ['outdoor']);
});

test('togglePublish and toggleFeature update the expected fields', async () => {
  const updates: any[] = [];
  const { service } = createService({
    prisma: {
      cafe: {
        findUnique: async () => ({
          id: 'cafe-1',
          isPublished: false,
          isFeatured: false,
          images: [],
        }),
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

test('uploadCafeMenuImage stores menu separately from gallery images', async () => {
  let uploadFolder = '';
  let updateData: any;
  const { service } = createService({
    prisma: {
      cafe: {
        findUnique: async () => ({ id: 'cafe-1', images: [], imageOrientations: [] }),
        update: async ({ data }: any) => {
          updateData = data;
          return { id: 'cafe-1', ...data };
        },
      },
    },
    storage: {
      uploadImage: async (_file: any, folder: string) => {
        uploadFolder = folder;
        return 'https://cdn.test/menu.webp';
      },
    },
  });

  const result = await service.uploadCafeMenuImage('cafe-1', { originalname: 'menu.webp' } as any);

  assert.equal(uploadFolder, 'cafes/cafe-1/menu');
  assert.deepEqual(updateData, { menuImage: 'https://cdn.test/menu.webp' });
  assert.deepEqual(result, {
    url: 'https://cdn.test/menu.webp',
    menuImage: 'https://cdn.test/menu.webp',
  });
});

test('importCafeImagesFromUrls appends imported image and sets cover image when empty', async () => {
  let importedFolder = '';
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
      uploadImageFromUrl: async (_url: string, folder: string) => {
        importedFolder = folder;
        return 'https://cdn.test/imported.webp';
      },
    },
  });

  const result = await service.importCafeImagesFromUrls('cafe-1', ['https://source.test/a.jpg']);

  assert.equal(importedFolder, 'cafes/cafe-1');
  assert.deepEqual(result.imported, ['https://cdn.test/imported.webp']);
  assert.deepEqual(result.failed, []);
  assert.deepEqual(updateData.images, [
    'https://cdn.test/old.webp',
    'https://cdn.test/imported.webp',
  ]);
  assert.deepEqual(updateData.imageOrientations, ['landscape', 'unknown']);
  assert.equal(updateData.coverImage, 'https://cdn.test/imported.webp');
});

test('importCafeImagesFromUrls with cover prepends images and uses first imported as cover', async () => {
  let index = 0;
  let updateData: any;
  const imported = ['https://cdn.test/one.webp', 'https://cdn.test/two.webp'];
  const { service } = createService({
    prisma: {
      cafe: {
        findUnique: async () => ({
          id: 'cafe-1',
          images: ['https://cdn.test/old.webp'],
          imageOrientations: ['landscape'],
          coverImage: 'https://cdn.test/old.webp',
        }),
        update: async ({ data }: any) => {
          updateData = data;
          return data;
        },
      },
    },
    storage: { uploadImageFromUrl: async () => imported[index++] },
  });

  await service.importCafeImagesFromUrls(
    'cafe-1',
    ['https://source.test/a.jpg', 'https://source.test/b.jpg'],
    true,
  );

  assert.deepEqual(updateData.images, [
    'https://cdn.test/one.webp',
    'https://cdn.test/two.webp',
    'https://cdn.test/old.webp',
  ]);
  assert.deepEqual(updateData.imageOrientations, ['unknown', 'unknown', 'landscape']);
  assert.equal(updateData.coverImage, 'https://cdn.test/one.webp');
});

test('importCafeImagesFromUrls keeps partial success and reports failed URLs', async () => {
  let updateData: any;
  const { service } = createService({
    prisma: {
      cafe: {
        findUnique: async () => ({
          id: 'cafe-1',
          images: [],
          imageOrientations: [],
          coverImage: null,
        }),
        update: async ({ data }: any) => {
          updateData = data;
          return data;
        },
      },
    },
    storage: {
      uploadImageFromUrl: async (url: string) => {
        if (url.includes('bad')) throw new Error('Source is not an image');
        if (url.includes('local')) throw new Error('Private or local image URLs are not allowed');
        return 'https://cdn.test/ok.webp';
      },
    },
  });

  const result = await service.importCafeImagesFromUrls('cafe-1', [
    'https://source.test/ok.jpg',
    'https://source.test/bad.txt',
    'http://127.0.0.1/local.jpg',
  ]);

  assert.deepEqual(result.imported, ['https://cdn.test/ok.webp']);
  assert.deepEqual(result.failed, [
    { url: 'https://source.test/bad.txt', reason: 'Source is not an image' },
    { url: 'http://127.0.0.1/local.jpg', reason: 'Private or local image URLs are not allowed' },
  ]);
  assert.deepEqual(updateData.images, ['https://cdn.test/ok.webp']);
});

test('importCafeImagesFromUrls does not import beyond the 12 image limit', async () => {
  const existingImages = Array.from({ length: 11 }, (_, index) => `https://cdn.test/${index}.webp`);
  let importCalls = 0;
  const { service } = createService({
    prisma: {
      cafe: {
        findUnique: async () => ({
          id: 'cafe-1',
          images: existingImages,
          imageOrientations: existingImages.map(() => 'unknown'),
          coverImage: existingImages[0],
        }),
        update: async ({ data }: any) => data,
      },
    },
    storage: {
      uploadImageFromUrl: async () => {
        importCalls += 1;
        return 'https://cdn.test/new.webp';
      },
    },
  });

  const result = await service.importCafeImagesFromUrls('cafe-1', [
    'https://source.test/a.jpg',
    'https://source.test/b.jpg',
  ]);

  assert.equal(importCalls, 1);
  assert.deepEqual(result.imported, ['https://cdn.test/new.webp']);
  assert.deepEqual(result.failed, [
    { url: 'https://source.test/b.jpg', reason: 'Cafe image gallery already has 12 images' },
  ]);
  assert.equal(result.images.length, 12);
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

test('reorderCafeImages updates image order and keeps matching orientations', async () => {
  let updateData: any;
  const { service } = createService({
    prisma: {
      cafe: {
        findUnique: async () => ({
          id: 'cafe-1',
          images: ['https://cdn.test/a.webp', 'https://cdn.test/b.webp', 'https://cdn.test/c.webp'],
          imageOrientations: ['landscape', 'portrait', 'unknown'],
          coverImage: 'https://cdn.test/b.webp',
        }),
        update: async ({ data }: any) => {
          updateData = data;
          return data;
        },
      },
    },
  });

  const result = await service.reorderCafeImages('cafe-1', [
    'https://cdn.test/c.webp',
    'https://cdn.test/a.webp',
    'https://cdn.test/b.webp',
  ]);

  assert.deepEqual(updateData.images, [
    'https://cdn.test/c.webp',
    'https://cdn.test/a.webp',
    'https://cdn.test/b.webp',
  ]);
  assert.deepEqual(updateData.imageOrientations, ['unknown', 'landscape', 'portrait']);
  assert.equal(updateData.coverImage, 'https://cdn.test/b.webp');
  assert.deepEqual(result, updateData);
});

test('reorderCafeImages rejects incomplete, foreign, or duplicate image URLs', async () => {
  const { service } = createService({
    prisma: {
      cafe: {
        findUnique: async () => ({
          id: 'cafe-1',
          images: ['https://cdn.test/a.webp', 'https://cdn.test/b.webp'],
          imageOrientations: ['landscape', 'portrait'],
          coverImage: 'https://cdn.test/a.webp',
        }),
      },
    },
  });

  await assert.rejects(
    () => service.reorderCafeImages('cafe-1', ['https://cdn.test/a.webp']),
    BadRequestException,
  );
  await assert.rejects(
    () =>
      service.reorderCafeImages('cafe-1', [
        'https://cdn.test/a.webp',
        'https://cdn.test/missing.webp',
      ]),
    BadRequestException,
  );
  await assert.rejects(
    () =>
      service.reorderCafeImages('cafe-1', ['https://cdn.test/a.webp', 'https://cdn.test/a.webp']),
    BadRequestException,
  );
});
