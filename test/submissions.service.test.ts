import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { validateSync } from 'class-validator';
import {
  ImageUploadFileValidator,
  SubmissionsController,
  validateBatchFiles,
} from '../src/submissions/submissions.controller';
import { CreateSubmissionDto } from '../src/submissions/dto/create-submission.dto';
import { SubmissionsService } from '../src/submissions/submissions.service';
import { isHeicImage } from '../src/storage/storage.service';

test('image upload validator accepts HEIC and HEIF by MIME or extension', () => {
  const validator = new ImageUploadFileValidator({});

  assert.equal(validator.isValid({ originalname: 'iphone.HEIC', mimetype: '' } as any), true);
  assert.equal(
    validator.isValid({ originalname: 'scan.bin', mimetype: 'image/heif' } as any),
    true,
  );
  assert.equal(
    validator.isValid({ originalname: 'notes.txt', mimetype: 'text/plain' } as any),
    false,
  );
  assert.equal(isHeicImage({ originalname: 'live.heifs', mimetype: '' } as any), true);
});

test('batch uploads reject more than 40MB before storage and accept exactly 40MB', () => {
  const files = [
    { originalname: 'first.jpg', mimetype: 'image/jpeg', size: 20 * 1024 * 1024 },
    { originalname: 'second.jpg', mimetype: 'image/jpeg', size: 20 * 1024 * 1024 },
  ] as any;
  validateBatchFiles(files);
  assert.throws(
    () => validateBatchFiles([{ ...files[0], size: files[0].size + 1 }, files[1]]),
    /Batch is too large/,
  );

  let storageCalls = 0;
  const controller = new SubmissionsController({
    uploadImages: async () => {
      storageCalls += 1;
    },
  } as any);
  assert.throws(
    () =>
      controller.uploadImages({ id: 'user-1' }, 'submission-1', [
        { ...files[0], size: files[0].size + 1 },
        files[1],
      ]),
    /Batch is too large/,
  );
  assert.equal(storageCalls, 0);
});

test('CreateSubmissionDto accepts submission type and payload with whitelist validation', () => {
  const dto = Object.assign(new CreateSubmissionDto(), {
    name: 'Owner Cafe',
    submissionType: 'owner',
    payload: { ownerName: 'Anh Chu' },
  });

  assert.deepEqual(validateSync(dto, { whitelist: true, forbidNonWhitelisted: true }), []);
});

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
  const service = new SubmissionsService(prisma as any, {} as any);

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

test('create stores detail draft payload', async () => {
  let createArgs: any;
  const prisma = {
    cafeSubmission: {
      create: async (args: any) => {
        createArgs = args;
        return { id: 'submission-1', ...args.data };
      },
    },
  };
  const service = new SubmissionsService(prisma as any, {} as any);

  await service.create('user-1', {
    name: 'Cafe Draft',
    payload: { name: 'Cafe Draft', images: ['https://img.test/1.webp'] },
  });

  assert.deepEqual(createArgs.data.payload, {
    name: 'Cafe Draft',
    images: ['https://img.test/1.webp'],
  });
  assert.equal(createArgs.data.submissionType, 'community');
  assert.equal(createArgs.data.status, 'pending');
});

test('create stores owner submission type', async () => {
  let createArgs: any;
  const prisma = {
    cafeSubmission: {
      create: async (args: any) => {
        createArgs = args;
        return { id: 'submission-1', ...args.data };
      },
    },
  };
  const service = new SubmissionsService(prisma as any, {} as any);

  await service.create('user-1', {
    name: 'Owner Cafe',
    submissionType: 'owner',
    payload: { ownerName: 'Anh Chủ' },
  });

  assert.equal(createArgs.data.submissionType, 'owner');
  assert.equal(createArgs.data.status, 'draft');
  assert.deepEqual(createArgs.data.payload, { ownerName: 'Anh Chủ' });
});

test('update preserves owner contribution payload fields', async () => {
  let findFirstArgs: any;
  let updateArgs: any;
  const payload = {
    parkingLocation: 'Hầm B1',
    signatureDrink: 'Cold brew',
    instagramUrl: 'https://instagram.com/cafe',
    ownerName: 'Anh Chủ',
    ownerPhone: '0900000000',
    ownerEmail: 'owner@test.dev',
    ownerRole: 'Chủ quán',
    ownerProofNote: 'Có giấy phép kinh doanh',
    openingTime: '07:00',
    closingTime: '22:00',
    priceMin: 45000,
    priceMax: 90000,
    menuImages: ['menu.webp'],
  };
  const prisma = {
    cafeSubmission: {
      findFirst: async (args: any) => {
        findFirstArgs = args;
        return { id: 'submission-1', submissionType: 'owner' };
      },
      update: async (args: any) => {
        updateArgs = args;
        return { id: args.where.id, ...args.data };
      },
    },
  };
  const service = new SubmissionsService(prisma as any, {} as any);

  await service.update('user-1', 'submission-1', { name: 'Owner Cafe', payload });

  assert.deepEqual(updateArgs.data.payload, payload);
  assert.deepEqual(findFirstArgs.where, {
    id: 'submission-1',
    submittedById: 'user-1',
    status: 'draft',
    isHidden: false,
  });
  assert.equal(updateArgs.data.submissionType, 'owner');
});

test('uploadImage only updates submitter-owned draft payload', async () => {
  let updateArgs: any;
  let uploadedFile: any;
  let lockQuery: any;
  const findFirstCalls: any[] = [];
  const prisma = {
    cafeSubmission: {
      findFirst: async (args: any) => {
        findFirstCalls.push(args);
        return args.where.submittedById === 'user-1'
          ? { id: 'submission-1', payload: { images: ['old.webp'] } }
          : null;
      },
      update: async (args: any) => {
        updateArgs = args;
        return { id: args.where.id, ...args.data };
      },
    },
    $queryRaw: async (query: any) => {
      lockQuery = query;
    },
    $transaction: async (fn: any) => fn(prisma),
  };
  const storage = {
    uploadImage: async (file: any) => {
      uploadedFile = file;
      return 'new.webp';
    },
  };
  const service = new SubmissionsService(prisma as any, storage as any);
  const heicFile = { originalname: 'owner.HEIC', mimetype: '', buffer: Buffer.from('heic') };

  await assert.rejects(
    () => service.uploadImage('user-2', 'submission-1', {} as any, 'images'),
    /Submission not found/,
  );
  await service.uploadImage('user-1', 'submission-1', heicFile as any, 'images');

  assert.equal(uploadedFile, heicFile);
  assert.equal(findFirstCalls[1].where.status, 'draft');
  assert.match(lockQuery.strings.join('?'), /CAST\(\? AS uuid\)/);
  assert.deepEqual(updateArgs.data.payload.images, ['old.webp', 'new.webp']);
  assert.deepEqual(updateArgs.data.payload.imageOrientations, ['unknown']);
  assert.equal(updateArgs.data.payload.coverImage, 'new.webp');
});

test('uploadImages preserves selected file order', async () => {
  let updateArgs: any;
  const uploaded: string[] = [];
  const prisma = {
    cafeSubmission: {
      findFirst: async () => ({
        id: 'submission-1',
        payload: { images: ['old.webp'], imageOrientations: ['landscape'] },
      }),
      update: async (args: any) => {
        updateArgs = args;
        return { id: args.where.id, ...args.data };
      },
    },
    $queryRaw: async () => {},
    $transaction: async (fn: any) => fn(prisma),
  };
  const storage = {
    uploadImage: async (file: any) => {
      uploaded.push(file.originalname);
      return `${file.originalname}.webp`;
    },
  };
  const service = new SubmissionsService(prisma as any, storage as any);

  await service.uploadImages(
    'user-1',
    'submission-1',
    [{ originalname: 'first' }, { originalname: 'second' }] as any,
    'images',
  );

  assert.deepEqual(uploaded, ['first', 'second']);
  assert.deepEqual(updateArgs.data.payload.images, ['old.webp', 'first.webp', 'second.webp']);
  assert.deepEqual(updateArgs.data.payload.imageOrientations, ['landscape', 'unknown', 'unknown']);
});

test('uploadImages appends menuImages in selected order', async () => {
  let updateArgs: any;
  const prisma = {
    cafeSubmission: {
      findFirst: async () => ({ id: 'submission-1', payload: { menuImages: ['old-menu.webp'] } }),
      update: async (args: any) => {
        updateArgs = args;
        return { id: args.where.id, ...args.data };
      },
    },
    $queryRaw: async () => {},
    $transaction: async (fn: any) => fn(prisma),
  };
  const storage = {
    uploadImage: async (file: any) => `${file.originalname}.webp`,
  };
  const service = new SubmissionsService(prisma as any, storage as any);

  await service.uploadImages(
    'user-1',
    'submission-1',
    [{ originalname: 'menu-1' }, { originalname: 'menu-2' }] as any,
    'menuImages',
  );

  assert.deepEqual(updateArgs.data.payload.menuImages, [
    'old-menu.webp',
    'menu-1.webp',
    'menu-2.webp',
  ]);
});

test('uploadImages merges into latest payload inside transaction', async () => {
  let findFirstCount = 0;
  let updateArgs: any;
  const prisma = {
    cafeSubmission: {
      findFirst: async () => {
        findFirstCount += 1;
        return {
          id: 'submission-1',
          payload:
            findFirstCount === 1
              ? { images: ['old.webp'] }
              : {
                  images: ['old.webp', 'fresh.webp'],
                  imageOrientations: ['landscape', 'portrait'],
                },
        };
      },
      update: async (args: any) => {
        updateArgs = args;
        return { id: args.where.id, ...args.data };
      },
    },
    $queryRaw: async () => {},
    $transaction: async (fn: any) => fn(prisma),
  };
  const storage = { uploadImage: async (file: any) => `${file.originalname}.webp` };
  const service = new SubmissionsService(prisma as any, storage as any);

  await service.uploadImages('user-1', 'submission-1', [{ originalname: 'new' }] as any, 'images');

  assert.deepEqual(updateArgs.data.payload.images, ['old.webp', 'fresh.webp', 'new.webp']);
  assert.deepEqual(updateArgs.data.payload.imageOrientations, ['landscape', 'portrait', 'unknown']);
});

test('uploadImages deletes already uploaded files when later upload fails', async () => {
  const deleted: string[] = [];
  const prisma = {
    cafeSubmission: {
      findFirst: async () => ({ id: 'submission-1', payload: {} }),
    },
  };
  const storage = {
    uploadImage: async (file: any) => {
      if (file.originalname === 'bad') throw new Error('upload failed');
      return `${file.originalname}.webp`;
    },
    deleteImage: async (url: string) => {
      deleted.push(url);
    },
  };
  const service = new SubmissionsService(prisma as any, storage as any);

  await assert.rejects(
    () =>
      service.uploadImages(
        'user-1',
        'submission-1',
        [{ originalname: 'ok' }, { originalname: 'bad' }] as any,
        'images',
      ),
    /upload failed/,
  );
  assert.deepEqual(deleted, ['ok.webp']);
});

test('submit validates owner draft before moving to pending', async () => {
  let updateArgs: any;
  const prisma = {
    cafeSubmission: {
      findFirst: async ({ where }: any) =>
        where.submittedById === 'user-1'
          ? {
              id: 'submission-1',
              submissionType: 'owner',
              name: 'Owner Cafe',
              address: null,
              googleMapsUrl: null,
              payload: {
                name: 'Owner Cafe',
                images: ['cover.webp'],
                googleMapsUrl: 'https://maps.test',
                openingTime: '07:00',
                closingTime: '22:00',
              },
            }
          : null,
      update: async (args: any) => {
        updateArgs = args;
        return { id: args.where.id, status: args.data.status };
      },
    },
  };
  const service = new SubmissionsService(prisma as any, {} as any);

  await service.submit('user-1', 'submission-1');
  await assert.rejects(() => service.submit('user-2', 'submission-1'), /Submission not found/);

  assert.deepEqual(updateArgs, { where: { id: 'submission-1' }, data: { status: 'pending' } });
});

test('submit rejects incomplete owner draft', async () => {
  const prisma = {
    cafeSubmission: {
      findFirst: async () => ({
        id: 'submission-1',
        submissionType: 'owner',
        name: '',
        address: null,
        googleMapsUrl: null,
        payload: { images: [] },
      }),
    },
  };
  const service = new SubmissionsService(prisma as any, {} as any);

  await assert.rejects(
    () => service.submit('user-1', 'submission-1'),
    /Missing required owner payload/,
  );
});

const thirteenImages = Array.from({ length: 13 }, (_, index) => `image-${index}.webp`);

test('owner gallery quota rejects payloads and direct uploads over twelve images', async () => {
  const createPrisma = { cafeSubmission: { create: async () => ({}) } };
  const createService = new SubmissionsService(createPrisma as any, {} as any);
  await assert.rejects(
    () =>
      createService.create('user-1', {
        name: 'Owner',
        submissionType: 'owner',
        payload: { images: thirteenImages },
      }),
    /Owner gallery allows at most 12 images/,
  );

  const updatePrisma = {
    cafeSubmission: {
      findFirst: async () => ({ id: 'submission-1', submissionType: 'owner' }),
      update: async () => ({}),
    },
  };
  const updateService = new SubmissionsService(updatePrisma as any, {} as any);
  await assert.rejects(
    () =>
      updateService.update('user-1', 'submission-1', {
        name: 'Owner',
        payload: { images: thirteenImages },
      }),
    /Owner gallery allows at most 12 images/,
  );

  const completePayload = {
    name: 'Owner',
    images: thirteenImages,
    googleMapsUrl: 'https://maps.test',
    openingTime: '07:00',
    closingTime: '22:00',
  };
  const submitPrisma = {
    cafeSubmission: {
      findFirst: async () => ({
        id: 'submission-1',
        submissionType: 'owner',
        name: 'Owner',
        address: null,
        googleMapsUrl: null,
        payload: completePayload,
      }),
    },
  };
  const submitService = new SubmissionsService(submitPrisma as any, {} as any);
  await assert.rejects(
    () => submitService.submit('user-1', 'submission-1'),
    /Owner gallery allows at most 12 images/,
  );

  const uploadPrisma = {
    cafeSubmission: {
      findFirst: async () => ({
        id: 'submission-1',
        submissionType: 'owner',
        payload: { images: thirteenImages.slice(0, 12) },
      }),
    },
  };
  const uploadService = new SubmissionsService(uploadPrisma as any, {} as any);
  await assert.rejects(
    () => uploadService.uploadImage('user-1', 'submission-1', {} as any, 'images'),
    /Owner gallery allows at most 12 images/,
  );
  await assert.rejects(
    () => uploadService.uploadImages('user-1', 'submission-1', [{}, {}] as any, 'images'),
    /Owner gallery allows at most 12 images/,
  );
});

test('owner gallery accepts the twelfth image and rechecks quota under its row lock', async () => {
  let locked = false;
  let updateArgs: any;
  const elevenImages = thirteenImages.slice(0, 11);
  const prisma = {
    cafeSubmission: {
      findFirst: async () => ({
        id: 'submission-1',
        submissionType: 'owner',
        payload: { images: elevenImages },
      }),
      update: async (args: any) => {
        updateArgs = args;
        return args;
      },
    },
    $queryRaw: async () => {
      locked = true;
    },
    $transaction: async (fn: any) => fn(prisma),
  };
  const storage = { uploadImage: async () => 'twelfth.webp', deleteImage: async () => {} };
  const service = new SubmissionsService(prisma as any, storage as any);
  await service.uploadImages('user-1', 'submission-1', [{}] as any, 'images');
  assert.equal(locked, true);
  assert.deepEqual(updateArgs.data.payload.images, [...elevenImages, 'twelfth.webp']);

  let reads = 0;
  const deleted: string[] = [];
  const racedPrisma = {
    cafeSubmission: {
      findFirst: async () => {
        reads += 1;
        return {
          id: 'submission-1',
          submissionType: 'owner',
          payload: { images: reads === 1 ? elevenImages : thirteenImages.slice(0, 12) },
        };
      },
    },
    $queryRaw: async () => {},
    $transaction: async (fn: any) => fn(racedPrisma),
  };
  const racedService = new SubmissionsService(
    racedPrisma as any,
    {
      uploadImage: async () => 'raced.webp',
      deleteImage: async (url: string) => {
        deleted.push(url);
      },
    } as any,
  );
  await assert.rejects(
    () => racedService.uploadImages('user-1', 'submission-1', [{}] as any, 'images'),
    /Owner gallery allows at most 12 images/,
  );
  assert.deepEqual(deleted, ['raced.webp']);
});
