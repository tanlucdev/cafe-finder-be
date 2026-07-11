import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import {
  cloudinaryPublicIdFromUrl,
  getImageStorageProvider,
  signCloudinaryParams,
} from '../src/storage/storage.service';
import { mapImageUrls } from '../scripts/migrate-images-to-cloudinary';

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
