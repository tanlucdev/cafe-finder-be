import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { validateSync } from 'class-validator';
import { ImageUploadFileValidator } from '../src/submissions/submissions.controller';
import { CreateSubmissionDto } from '../src/submissions/dto/create-submission.dto';
import { SubmissionsService } from '../src/submissions/submissions.service';
import { isHeicImage } from '../src/storage/storage.service';

test('image upload validator accepts HEIC and HEIF by MIME or extension', () => {
  const validator = new ImageUploadFileValidator({});

  assert.equal(validator.isValid({ originalname: 'iphone.HEIC', mimetype: '' } as any), true);
  assert.equal(validator.isValid({ originalname: 'scan.bin', mimetype: 'image/heif' } as any), true);
  assert.equal(validator.isValid({ originalname: 'notes.txt', mimetype: 'text/plain' } as any), false);
  assert.equal(isHeicImage({ originalname: 'live.heifs', mimetype: '' } as any), true);
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
  assert.deepEqual(updateArgs.data.payload.images, ['old.webp', 'new.webp']);
  assert.deepEqual(updateArgs.data.payload.imageOrientations, ['unknown']);
  assert.equal(updateArgs.data.payload.coverImage, 'new.webp');
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

  await assert.rejects(() => service.submit('user-1', 'submission-1'), /Missing required owner payload/);
});
