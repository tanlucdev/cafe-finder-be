import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { NotFoundException } from '@nestjs/common';
import { AdminBlogsService } from '../src/admin/blogs/admin-blogs.service';

function createService(overrides: any = {}) {
  const prisma = {
    blogPost: {
      findMany: async () => [],
      count: async () => 0,
      findUnique: async () => ({
        id: 'post-1',
        slug: 'bai-viet',
        isPublished: false,
        isFeatured: false,
        publishedAt: null,
      }),
      create: async ({ data }: any) => ({ id: 'post-1', ...data }),
      update: async ({ where, data }: any) => ({ id: where.id, ...data }),
      delete: async ({ where }: any) => ({ id: where.id }),
    },
    ...overrides.prisma,
  };

  return {
    service: new AdminBlogsService(prisma as any),
    prisma,
  };
}

test('listPosts applies blog filters and pagination', async () => {
  let findManyArgs: any;
  let countArgs: any;
  const { service } = createService({
    prisma: {
      blogPost: {
        findMany: async (args: any) => {
          findManyArgs = args;
          return [{ id: 'post-1' }];
        },
        count: async (args: any) => {
          countArgs = args;
          return 11;
        },
      },
    },
  });

  const result = await service.listPosts({
    search: 'sáng',
    tag: 'morning',
    is_published: true,
    is_featured: false,
    page: 2,
    limit: 5,
  });

  assert.equal(findManyArgs.skip, 5);
  assert.equal(findManyArgs.take, 5);
  assert.deepEqual(findManyArgs.where.tags, { has: 'morning' });
  assert.equal(findManyArgs.where.isPublished, true);
  assert.equal(findManyArgs.where.isFeatured, false);
  assert.equal(findManyArgs.where.OR.length, 5);
  assert.deepEqual(countArgs, { where: findManyArgs.where });
  assert.deepEqual(result.meta, { total: 11, page: 2, limit: 5, totalPages: 3 });
});

test('createPost generates slug, cleans lists, and sets publishedAt when published', async () => {
  let createData: any;
  const { service } = createService({
    prisma: {
      blogPost: {
        create: async ({ data }: any) => {
          createData = data;
          return { id: 'post-1', ...data };
        },
      },
    },
  });

  const result = await service.createPost({
    titleVi: 'Một buổi sáng chậm',
    excerptVi: 'Đoạn mô tả',
    categoryVi: 'Nhật ký',
    tags: ['morning', ' ', 'quiet'],
    checklistVi: ['Mang sách', ''],
    isPublished: true,
  });

  assert.equal(createData.slug, 'mot-buoi-sang-cham');
  assert.deepEqual(createData.tags, ['morning', 'quiet']);
  assert.deepEqual(createData.checklistVi, ['Mang sách']);
  assert.ok(createData.publishedAt instanceof Date);
  assert.equal(result.slug, 'mot-buoi-sang-cham');
});

test('updatePost does not overwrite existing publishedAt when already published', async () => {
  let updateData: any;
  const publishedAt = new Date('2026-05-01T00:00:00.000Z');
  const { service } = createService({
    prisma: {
      blogPost: {
        findUnique: async () => ({ id: 'post-1', isPublished: true, publishedAt }),
        update: async ({ data }: any) => {
          updateData = data;
          return { id: 'post-1', ...data };
        },
      },
    },
  });

  await service.updatePost('post-1', { isPublished: true });

  assert.equal(updateData.isPublished, true);
  assert.equal('publishedAt' in updateData, false);
});

test('togglePublish and toggleFeature update expected fields', async () => {
  const updates: any[] = [];
  const { service } = createService({
    prisma: {
      blogPost: {
        findUnique: async () => ({
          id: 'post-1',
          isPublished: false,
          isFeatured: false,
          publishedAt: null,
        }),
        update: async (args: any) => {
          updates.push(args);
          return { id: args.where.id, ...args.data };
        },
      },
    },
  });

  await service.togglePublish('post-1');
  await service.toggleFeature('post-1', 3);

  assert.equal(updates[0].data.isPublished, true);
  assert.ok(updates[0].data.publishedAt instanceof Date);
  assert.deepEqual(updates[1].data, { isFeatured: true, featuredOrder: 3 });
});

test('getPost throws when blog post does not exist', async () => {
  const { service } = createService({
    prisma: { blogPost: { findUnique: async () => null } },
  });

  await assert.rejects(() => service.getPost('missing'), NotFoundException);
});
