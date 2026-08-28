import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { AdminFeedbackService } from '../src/admin/feedback/admin-feedback.service';
import { UpdateFeedbackDto } from '../src/admin/feedback/dto/update-feedback.dto';
import { CreateFeedbackDto } from '../src/feedback/dto/create-feedback.dto';
import { FeedbackService } from '../src/feedback/feedback.service';

test('CreateFeedbackDto validates type, message, email, url, and cafeId', () => {
  const valid = plainToInstance(CreateFeedbackDto, {
    type: 'idea',
    message: '  Nội dung góp ý đủ dài  ',
    contactEmail: 'user@example.com',
    pageUrl: 'http://localhost:3000/vi/cafe/a',
    cafeId: '11111111-1111-4111-8111-111111111111',
  });
  const invalid = plainToInstance(CreateFeedbackDto, {
    type: 'spam',
    message: 'ngắn',
    contactEmail: 'bad',
    pageUrl: 'not-url',
    cafeId: 'slug',
  });

  assert.deepEqual(validateSync(valid, { whitelist: true, forbidNonWhitelisted: true }), []);
  assert.equal(valid.message, 'Nội dung góp ý đủ dài');
  assert.equal(validateSync(invalid, { whitelist: true, forbidNonWhitelisted: true }).length, 4);
});

test('FeedbackService trims fields, stores user agent, and returns lowercase NEW', async () => {
  let createdData: any;
  const service = new FeedbackService({
    feedback: {
      create: async ({ data }: any) => {
        createdData = data;
        return { id: 'feedback-1', status: 'NEW', ...data };
      },
    },
  } as any);

  const result = await service.create(
    plainToInstance(CreateFeedbackDto, { type: 'bug', message: '  Lỗi hiển thị trên mobile  ' }),
    'UA',
  );

  assert.equal(createdData.message, 'Lỗi hiển thị trên mobile');
  assert.equal(createdData.userAgent, 'UA');
  assert.equal(result.status, 'new');
});

test('AdminFeedbackService filters list, updates status/note, and 404s missing detail', async () => {
  let findManyArgs: any;
  let updateArgs: any;
  const service = new AdminFeedbackService({
    feedback: {
      findMany: async (args: any) => {
        findManyArgs = args;
        return [{ id: 'feedback-1', status: 'NEW' }];
      },
      count: async () => 1,
      findUnique: async ({ where }: any) => (where.id === 'missing' ? null : { id: where.id, status: 'NEW' }),
      update: async (args: any) => {
        updateArgs = args;
        return { id: args.where.id, status: args.data.status, adminNote: args.data.adminNote };
      },
    },
  } as any);

  const listed = await service.listFeedback('new', 2, 10, 'mobile');
  const updated = await service.updateFeedback(
    'feedback-1',
    plainToInstance(UpdateFeedbackDto, { status: 'reviewed', adminNote: '  Đã xem  ' }),
  );

  assert.equal(findManyArgs.where.status, 'NEW');
  assert.equal(findManyArgs.skip, 10);
  assert.equal(findManyArgs.where.OR.length, 4);
  assert.equal(listed.data[0].status, 'new');
  assert.equal(updateArgs.data.status, 'REVIEWED');
  assert.equal(updateArgs.data.adminNote, 'Đã xem');
  assert.equal(updated.status, 'reviewed');
  await assert.rejects(() => service.getFeedback('missing'), NotFoundException);
});
