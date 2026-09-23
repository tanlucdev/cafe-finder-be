import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { SubmissionAssetsService } from '../src/submissions/submission-assets.service';

const id = '11111111-1111-4111-8111-111111111111';
const publicId = `submissions/${id}/images/22222222-2222-4222-8222-222222222222`;
const secureUrl = `https://res.cloudinary.com/new-cloud/image/upload/v1/${publicId}.webp`;

function config() {
  return {
    get: (key: string, fallback = '') =>
      ({
        CLOUDINARY_CLOUD_NAME: 'new-cloud',
        CLOUDINARY_API_KEY: 'public-key',
        CLOUDINARY_API_SECRET: 'server-secret',
        CLOUDINARY_OWNER_UPLOAD_PRESET: 'owner-signed',
      })[key] ?? fallback,
  } as any;
}

function draft(payload: object = {}) {
  return {
    id,
    submittedById: 'owner',
    submissionType: 'owner',
    status: 'draft',
    isHidden: false,
    payload,
  };
}

test('signatures bind owner draft folder and never expose the API secret', async () => {
  let locked = false;
  let created: any;
  const prisma = {
    $queryRaw: async () => {
      locked = true;
    },
    $transaction: async (fn: any) => fn(prisma),
    cafeSubmission: { findFirst: async () => draft({ images: ['old.webp'] }) },
    submissionAsset: {
      count: async () => 0,
      createMany: async (args: any) => {
        created = args;
      },
    },
  };
  const service = new SubmissionAssetsService(prisma as any, config());
  const result = await service.signatures('owner', id, [
    { field: 'images' },
    { field: 'menuImages' },
  ]);

  assert.equal(locked, true);
  assert.equal(result.cloudName, 'new-cloud');
  assert.equal(result.apiKey, 'public-key');
  assert.equal(JSON.stringify(result).includes('server-secret'), false);
  assert.equal(result.assets[0].params.folder, `submissions/${id}/images`);
  assert.match(result.assets[0].params.public_id, /^[0-9a-f-]{36}$/);
  assert.equal(created.data.length, 2);
});

test('signatures reject another owner, non-drafts, and exhausted gallery quota', async () => {
  const absent = {
    $queryRaw: async () => {},
    $transaction: async (fn: any) => fn(absent),
    cafeSubmission: { findFirst: async () => null },
    submissionAsset: { count: async () => 0 },
  };
  const service = new SubmissionAssetsService(absent as any, config());
  await assert.rejects(
    () => service.signatures('owner', id, [{ field: 'images' }]),
    /Submission not found/,
  );

  const full = {
    $queryRaw: async () => {},
    $transaction: async (fn: any) => fn(full),
    cafeSubmission: {
      findFirst: async () => draft({ images: Array.from({ length: 12 }, String) }),
    },
    submissionAsset: { count: async () => 0 },
  };
  await assert.rejects(
    () =>
      new SubmissionAssetsService(full as any, config()).signatures('owner', id, [
        { field: 'images' },
      ]),
    /Owner gallery allows at most 12 images/,
  );
});

test('persist locks UUID row, rejects foreign URLs, and rechecks gallery quota', async () => {
  let lockQuery: any;
  const prisma = {
    $queryRaw: async (query: any) => {
      lockQuery = query;
    },
    $transaction: async (fn: any) => fn(prisma),
    cafeSubmission: {
      findFirst: async () => draft({ images: Array.from({ length: 12 }, String) }),
    },
    submissionAsset: {
      findFirst: async () => ({
        id: 'asset-1',
        field: 'images',
        publicId,
        secureUrl: null,
        status: 'signed',
        expiresAt: new Date(Date.now() + 60_000),
      }),
    },
  };
  const service = new SubmissionAssetsService(prisma as any, config());
  await assert.rejects(
    () => service.persist('owner', id, { public_id: publicId, secure_url: secureUrl }),
    /Owner gallery allows/,
  );
  assert.match(lockQuery.strings.join('?'), /CAST\(\? AS uuid\)/);
  await assert.rejects(
    () =>
      service.persist('owner', id, {
        public_id: publicId,
        secure_url: secureUrl.replace('new-cloud', 'old-cloud'),
      }),
    /canonical Cloudinary upload URL/,
  );
});

test('cleanup rejects assets outside the owner draft before Cloudinary deletion', async () => {
  const prisma = { submissionAsset: { findFirst: async () => null } };
  const service = new SubmissionAssetsService(prisma as any, config());
  await assert.rejects(() => service.remove('other-user', id, publicId), /Asset not found/);
});

test('cleanup destroys only the signed owner asset then atomically removes its payload URL', async () => {
  let deleted = false;
  let updated: any;
  const asset = { id: 'asset-1', field: 'images', publicId, secureUrl, status: 'persisted' };
  const prisma = {
    $queryRaw: async () => {},
    $transaction: async (fn: any) => fn(prisma),
    cafeSubmission: {
      findFirst: async () => draft({ images: [secureUrl], imageOrientations: ['portrait'] }),
      update: async (args: any) => {
        updated = args;
        return args;
      },
    },
    submissionAsset: {
      findFirst: async () => asset,
      delete: async () => {
        deleted = true;
      },
    },
  };
  const originalFetch = global.fetch;
  global.fetch = (async () =>
    new Response(JSON.stringify({ result: 'ok' }), { status: 200 })) as any;
  try {
    await new SubmissionAssetsService(prisma as any, config()).remove('owner', id, publicId);
  } finally {
    global.fetch = originalFetch;
  }
  assert.equal(deleted, true);
  assert.deepEqual(updated.data.payload.images, []);
  assert.equal(updated.data.payload.coverImage, undefined);
});
