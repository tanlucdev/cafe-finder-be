import 'reflect-metadata';
import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { PATH_METADATA } from '@nestjs/common/constants';
import { AdminCafesController } from '../src/admin/cafes/admin-cafes.controller';
import { AdminStatsController } from '../src/admin/stats/admin-stats.controller';
import { AdminSubmissionsController } from '../src/admin/submissions/admin-submissions.controller';
import { AdminUsersController } from '../src/admin/users/admin-users.controller';

test('admin controllers expose admin route boundaries', () => {
  assert.equal(Reflect.getMetadata(PATH_METADATA, AdminCafesController), 'admin/cafes');
  assert.equal(Reflect.getMetadata(PATH_METADATA, AdminSubmissionsController), 'admin/submissions');
  assert.equal(Reflect.getMetadata(PATH_METADATA, AdminUsersController), 'admin/users');
  assert.equal(Reflect.getMetadata(PATH_METADATA, AdminStatsController), 'admin/stats');
});

test('AdminCafesController delegates cafe actions to service', async () => {
  const calls: any[] = [];
  const service = {
    listCafes: async (filter: any) => calls.push(['list', filter]),
    getCafe: async (id: string) => calls.push(['get', id]),
    createCafe: async (dto: any) => calls.push(['create', dto]),
    updateCafe: async (id: string, dto: any) => calls.push(['update', id, dto]),
    deleteCafe: async (id: string) => calls.push(['delete', id]),
    togglePublish: async (id: string) => calls.push(['publish', id]),
    toggleFeature: async (id: string, order?: number) => calls.push(['feature', id, order]),
    uploadCafeImage: async (id: string, file: any, setCover?: boolean) =>
      calls.push(['upload', id, file.originalname, setCover === true]),
    deleteCafeImage: async (id: string, url: string) => calls.push(['deleteImage', id, url]),
    reorderCafeImages: async (id: string, urls: string[]) =>
      calls.push(['reorderImages', id, urls]),
  };
  const controller = new AdminCafesController(service as any);

  await controller.listCafes({ search: 'coffee' });
  await controller.getCafe('cafe-1');
  await controller.createCafe({ name: 'Cafe' } as any);
  await controller.updateCafe('cafe-1', { name: 'Cafe 2' });
  await controller.replaceCafe('cafe-1', { name: 'Cafe 3' });
  await controller.deleteCafe('cafe-1');
  await controller.togglePublish('cafe-1');
  await controller.toggleFeature('cafe-1', { featuredOrder: 1 });
  await controller.uploadImage('cafe-1', 'true', { originalname: 'image.webp' } as any);
  await controller.deleteImage('cafe-1', { imageUrl: 'https://cdn.test/image.webp' });
  await controller.reorderImages('cafe-1', {
    imageUrls: ['https://cdn.test/b.webp', 'https://cdn.test/a.webp'],
  });

  assert.deepEqual(calls, [
    ['list', { search: 'coffee' }],
    ['get', 'cafe-1'],
    ['create', { name: 'Cafe' }],
    ['update', 'cafe-1', { name: 'Cafe 2' }],
    ['update', 'cafe-1', { name: 'Cafe 3' }],
    ['delete', 'cafe-1'],
    ['publish', 'cafe-1'],
    ['feature', 'cafe-1', 1],
    ['upload', 'cafe-1', 'image.webp', true],
    ['deleteImage', 'cafe-1', 'https://cdn.test/image.webp'],
    ['reorderImages', 'cafe-1', ['https://cdn.test/b.webp', 'https://cdn.test/a.webp']],
  ]);
});

test('admin submissions, users, and stats controllers delegate to services', async () => {
  const calls: any[] = [];
  const submissionsController = new AdminSubmissionsController({
    listSubmissions: async (status?: string) => calls.push(['submissions:list', status]),
    getSubmission: async (id: string) => calls.push(['submissions:get', id]),
    approveSubmission: async (id: string) => calls.push(['submissions:approve', id]),
    rejectSubmission: async (id: string) => calls.push(['submissions:reject', id]),
  } as any);
  const usersController = new AdminUsersController({
    listUsers: async (page: number, limit: number) => calls.push(['users:list', page, limit]),
  } as any);
  const statsController = new AdminStatsController({
    getStats: async () => calls.push(['stats:get']),
  } as any);

  await submissionsController.listSubmissions('pending');
  await submissionsController.getSubmission('submission-1');
  await submissionsController.approveSubmission('submission-1');
  await submissionsController.rejectSubmission('submission-1');
  await usersController.listUsers(2, 10);
  await statsController.getStats();

  assert.deepEqual(calls, [
    ['submissions:list', 'pending'],
    ['submissions:get', 'submission-1'],
    ['submissions:approve', 'submission-1'],
    ['submissions:reject', 'submission-1'],
    ['users:list', 2, 10],
    ['stats:get'],
  ]);
});
