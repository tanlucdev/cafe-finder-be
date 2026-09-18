import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { AdminReviewsService } from '../src/admin/reviews/admin-reviews.service';
import { UpdateReviewDto } from '../src/admin/reviews/dto/update-review.dto';
import { UpsertReviewDto } from '../src/reviews/dto/upsert-review.dto';
import { ReviewsService } from '../src/reviews/reviews.service';

function createPrisma() {
  const reviews: any[] = [];
  const cafes = new Set(['cafe-1']);
  const withUser = (review: any) => ({
    ...review,
    user: { displayName: review.userName ?? null, email: review.email ?? 'user@example.com' },
    cafe: { id: review.cafeId, name: 'Cafe One', slug: 'cafe-one' },
  });
  const prisma = {
    cafe: {
      findFirst: async ({ where }: any) =>
        cafes.has(where.id) && where.isPublished ? { id: where.id } : null,
    },
    cafeReview: {
      findMany: async ({ where }: any) =>
        reviews
          .filter((review) => (
            (!where.cafeId || review.cafeId === where.cafeId) &&
            (where.isHidden === undefined || review.isHidden === where.isHidden)
          ))
          .map(withUser),
      count: async ({ where }: any) =>
        reviews.filter((review) => (
          (!where.cafeId || review.cafeId === where.cafeId) &&
          (where.isHidden === undefined || review.isHidden === where.isHidden)
        )).length,
      aggregate: async ({ where }: any) => {
        const ratings = reviews
          .filter((review) => review.cafeId === where.cafeId && !review.isHidden && review.rating !== null)
          .map((review) => review.rating);
        return {
          _count: { rating: ratings.length },
          _avg: { rating: ratings.length ? ratings.reduce((sum, value) => sum + value, 0) / ratings.length : null },
        };
      },
      findUnique: async ({ where }: any) => {
        const review = where.id
          ? reviews.find((item) => item.id === where.id)
          : reviews.find((item) => (
              item.userId === where.userId_cafeId.userId && item.cafeId === where.userId_cafeId.cafeId
            ));
        return review ? withUser(review) : null;
      },
      upsert: async ({ where, create, update }: any) => {
        const index = reviews.findIndex((item) => (
          item.userId === where.userId_cafeId.userId && item.cafeId === where.userId_cafeId.cafeId
        ));
        if (index >= 0) reviews[index] = { ...reviews[index], ...update, updatedAt: new Date() };
        else reviews.push({ id: `review-${reviews.length + 1}`, isHidden: false, createdAt: new Date(), updatedAt: new Date(), ...create });
        return withUser(reviews[index >= 0 ? index : reviews.length - 1]);
      },
      deleteMany: async ({ where }: any) => {
        const before = reviews.length;
        for (let index = reviews.length - 1; index >= 0; index -= 1) {
          if (reviews[index].userId === where.userId && reviews[index].cafeId === where.cafeId) reviews.splice(index, 1);
        }
        return { count: before - reviews.length };
      },
      update: async ({ where, data }: any) => {
        const review = reviews.find((item) => item.id === where.id);
        Object.assign(review, data);
        return withUser(review);
      },
    },
  };
  return { prisma, reviews, cafes };
}

test('UpsertReviewDto validates rating and content shape', () => {
  const valid = plainToInstance(UpsertReviewDto, { rating: 5, content: '  ok  ' });
  const invalid = plainToInstance(UpsertReviewDto, { rating: 6, content: 'x'.repeat(2001) });

  assert.deepEqual(validateSync(valid, { whitelist: true, forbidNonWhitelisted: true }), []);
  assert.equal(valid.content, 'ok');
  assert.equal(validateSync(invalid, { whitelist: true, forbidNonWhitelisted: true }).length, 2);
});

test('ReviewsService creates, updates same user/cafe, deletes, and rejects empty payload', async () => {
  const { prisma, reviews } = createPrisma();
  const service = new ReviewsService(prisma as any);

  const created = await service.upsert('user-1', 'cafe-1', { rating: 5 });
  const updated = await service.upsert('user-1', 'cafe-1', { content: 'Nice corner' });

  assert.equal(created.rating, 5);
  assert.equal(updated.content, 'Nice corner');
  assert.equal(reviews.length, 1);
  await assert.rejects(() => service.upsert('user-1', 'cafe-1', {}), BadRequestException);
  assert.deepEqual(await service.deleteMine('user-1', 'cafe-1'), { deleted: true });
  assert.equal(reviews.length, 0);
});

test('ReviewsService excludes hidden reviews and ignores null ratings in summary', async () => {
  const { prisma, reviews } = createPrisma();
  const service = new ReviewsService(prisma as any);
  reviews.push(
    { id: 'a', userId: 'u1', cafeId: 'cafe-1', rating: 5, content: null, isHidden: false, createdAt: new Date(), updatedAt: new Date() },
    { id: 'b', userId: 'u2', cafeId: 'cafe-1', rating: null, content: 'Quiet', isHidden: false, email: 'user@example.com', userName: 'user@example.com', createdAt: new Date(), updatedAt: new Date() },
    { id: 'c', userId: 'u3', cafeId: 'cafe-1', rating: 1, content: 'Hidden', isHidden: true, createdAt: new Date(), updatedAt: new Date() },
  );

  const result = await service.list('cafe-1');

  assert.deepEqual(result.data.map((item) => item.id), ['a', 'b']);
  assert.equal(result.data[1].authorName, 'u***@example.com');
  assert.deepEqual(result.summary, { reviewCount: 2, ratingCount: 1, averageRating: 5 });
});

test('ReviewsService rejects unpublished cafes', async () => {
  const { prisma, cafes } = createPrisma();
  cafes.clear();
  const service = new ReviewsService(prisma as any);

  await assert.rejects(() => service.upsert('user-1', 'cafe-1', { rating: 5 }), NotFoundException);
});

test('AdminReviewsService filters, hides, unhides, and trims note', async () => {
  const { prisma, reviews } = createPrisma();
  const service = new AdminReviewsService(prisma as any);
  reviews.push({ id: 'a', userId: 'u1', cafeId: 'cafe-1', rating: 4, content: 'Nice', isHidden: false, email: 'admin@example.com', userName: 'admin@example.com', createdAt: new Date(), updatedAt: new Date() });

  const listed = await service.list('false', 'cafe-1', 'Nice');
  const hidden = await service.update('a', plainToInstance(UpdateReviewDto, { isHidden: true, adminNote: '  spam  ' }));
  const unhidden = await service.update('a', { isHidden: false });

  assert.equal(listed.data.length, 1);
  assert.equal(listed.data[0].authorName, 'a***@example.com');
  assert.equal(hidden.isHidden, true);
  assert.equal(hidden.adminNote, 'spam');
  assert.equal(unhidden.isHidden, false);
});
