import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import {
  cloudinaryOptimizedUrl,
  cloudinaryPublicIdFromUrl,
  getImageStorageProvider,
  signCloudinaryParams,
} from '../src/storage/storage.service';
import { StorageService } from '../src/storage/storage.service';
import { collectRefs, mapImageUrls, mappedBackup } from '../scripts/migrate-images-to-cloudinary';

test('cloudinary signature is stable', () => {
  assert.equal(
    signCloudinaryParams(
      { timestamp: '1700000000', folder: 'cafes/1', public_id: '1700000000-a' },
      'secret',
    ),
    '8ee4f66c8ff0611fd271e732d29053182de45477',
  );
});

test('image storage provider defaults to supabase', () => {
  assert.equal(getImageStorageProvider(undefined), 'supabase');
  assert.equal(getImageStorageProvider('supabase'), 'supabase');
  assert.equal(getImageStorageProvider('cloudinary'), 'cloudinary');
});

test('cloudinary optimized URL injects delivery transforms', () => {
  assert.equal(
    cloudinaryOptimizedUrl('https://res.cloudinary.com/demo/image/upload/v1/cafes/a.jpg'),
    'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/v1/cafes/a.jpg',
  );
});

test('cloudinary uploads always convert to WebP', async () => {
  const originalFetch = global.fetch;
  const service = new StorageService({
    get: (key: string, fallback = '') =>
      ({
        IMAGE_STORAGE_PROVIDER: 'cloudinary',
        CLOUDINARY_CLOUD_NAME: 'demo',
        CLOUDINARY_API_KEY: 'key',
        CLOUDINARY_API_SECRET: 'secret',
      })[key] ?? fallback,
  } as any);
  let converted = false;
  (service as any).convertToBestWebp = async () => {
    converted = true;
    return Buffer.from('webp');
  };
  global.fetch = (async () =>
    new Response(
      JSON.stringify({
        secure_url: 'https://res.cloudinary.com/demo/image/upload/v1/cafes/original.webp',
      }),
      {
        status: 200,
      },
    )) as any;

  try {
    const url = await service.uploadImage(
      { originalname: 'original.jpg', mimetype: 'image/jpeg', buffer: Buffer.from('jpg') } as any,
      'cafes',
    );
    assert.equal(converted, true);
    assert.equal(url, 'https://res.cloudinary.com/demo/image/upload/v1/cafes/original.webp');
  } finally {
    global.fetch = originalFetch;
  }
});

test('cloudinary public id is extracted from secure URL', () => {
  assert.equal(
    cloudinaryPublicIdFromUrl(
      'https://res.cloudinary.com/demo/image/upload/v1700000000/cafes/1/1700000000-a.webp',
      'demo',
    ),
    'cafes/1/1700000000-a',
  );
  assert.equal(
    cloudinaryPublicIdFromUrl(
      'https://res.cloudinary.com/other/image/upload/v1700000000/cafes/1/1700000000-a.webp',
      'demo',
    ),
    null,
  );
});

test('migration map preserves image order', async () => {
  const result = await mapImageUrls(
    [
      'https://old.supabase.co/storage/v1/object/public/cafe-images/cafes/1/a.webp',
      'https://cdn.test/keep.webp',
      'https://old.supabase.co/storage/v1/object/public/cafe-images/cafes/1/b.webp',
    ],
    'Cafe.images',
    'Cafe',
    '1',
    'cafes/1',
    {
      dryRun: false,
      upload: async (url) =>
        `https://res.cloudinary.com/demo/image/upload/v1/${url.split('/').at(-1)}`,
    },
  );

  assert.deepEqual(result.urls, [
    'https://res.cloudinary.com/demo/image/upload/v1/a.webp',
    'https://cdn.test/keep.webp',
    'https://res.cloudinary.com/demo/image/upload/v1/b.webp',
  ]);
});

test('migration map skips target cloudinary URLs and reuses cache for menuImages', async () => {
  const oldCloudName = process.env.NEW_CLOUDINARY_CLOUD_NAME;
  process.env.NEW_CLOUDINARY_CLOUD_NAME = 'demo';
  let uploads = 0;
  const cache = new Map<string, string>();
  try {
    const result = await mapImageUrls(
      [
        'https://old.supabase.co/storage/v1/object/public/cafe-images/cafes/1/menu-a.webp',
        'https://res.cloudinary.com/demo/image/upload/v1/cafes/1/menu-b.webp',
        'https://old.supabase.co/storage/v1/object/public/cafe-images/cafes/1/menu-a.webp',
      ],
      'Cafe.menuImages',
      'Cafe',
      '1',
      'cafes/1/menu',
      {
        dryRun: false,
        cache,
        upload: async (url) => {
          uploads += 1;
          return `https://res.cloudinary.com/demo/image/upload/v1/${url.split('/').at(-1)}`;
        },
      },
    );

    assert.equal(uploads, 1);
    assert.deepEqual(result.urls, [
      'https://res.cloudinary.com/demo/image/upload/v1/menu-a.webp',
      'https://res.cloudinary.com/demo/image/upload/v1/cafes/1/menu-b.webp',
      'https://res.cloudinary.com/demo/image/upload/v1/menu-a.webp',
    ]);
  } finally {
    if (oldCloudName === undefined) delete process.env.NEW_CLOUDINARY_CLOUD_NAME;
    else process.env.NEW_CLOUDINARY_CLOUD_NAME = oldCloudName;
  }
});

test('migration includes BlogPost.heroImage', () => {
  const backup = {
    createdAt: '2026-01-01T00:00:00.000Z',
    cafes: [],
    submissions: [],
    blogPosts: [
      {
        id: 'post-1',
        heroImage: 'https://old.supabase.co/storage/v1/object/public/cafe-images/blog/hero.webp',
      },
    ],
  };
  const refs = collectRefs(backup as any);
  const next = mappedBackup(backup as any, {
    'https://old.supabase.co/storage/v1/object/public/cafe-images/blog/hero.webp':
      'https://res.cloudinary.com/demo/image/upload/v1/blog/hero.webp',
  });

  assert.equal(refs[0].kind, 'blogPost');
  assert.equal(refs[0].field, 'heroImage');
  assert.equal(
    next.blogPosts[0].heroImage,
    'https://res.cloudinary.com/demo/image/upload/v1/blog/hero.webp',
  );
});

test('migration dry-run does not upload', async () => {
  const result = await mapImageUrls(
    ['https://old.supabase.co/storage/v1/object/public/cafe-images/cafes/1/a.webp'],
    'Cafe.images',
    'Cafe',
    '1',
    'cafes/1',
    {
      dryRun: true,
      upload: async () => {
        throw new Error('should not upload');
      },
    },
  );

  assert.deepEqual(result, {
    urls: ['https://old.supabase.co/storage/v1/object/public/cafe-images/cafes/1/a.webp'],
    changed: false,
  });
});
