import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertReviewDto } from './dto/upsert-review.dto';

const pageValue = (value: number, fallback: number, max?: number) => {
  const next = Number(value);
  if (!Number.isInteger(next) || next <= 0) return fallback;
  return max ? Math.min(next, max) : next;
};

const maskEmail = (email?: string | null) => {
  if (!email) return 'Cafe Maps user';
  const [name, domain] = email.split('@');
  if (!domain) return 'Cafe Maps user';
  return `${name.slice(0, 1) || 'u'}***@${domain}`;
};

const authorName = (user?: { displayName?: string | null; email?: string | null } | null) =>
  user?.displayName?.trim() && !user.displayName.includes('@')
    ? user.displayName.trim()
    : maskEmail(user?.email);

const serializeReview = (review: any, userId?: string) => ({
  id: review.id,
  cafeId: review.cafeId,
  rating: review.rating,
  content: review.content,
  authorName: authorName(review.user),
  createdAt: review.createdAt,
  updatedAt: review.updatedAt,
  ...(userId ? { isMine: review.userId === userId } : {}),
});

const serializeProfileReview = (review: any) => ({
  id: review.id,
  cafeId: review.cafeId,
  rating: review.rating,
  content: review.content,
  createdAt: review.createdAt,
  updatedAt: review.updatedAt,
  cafe: review.cafe,
});

@Injectable()
export class ReviewsService {
  constructor(private prisma: PrismaService) {}

  async list(cafeId: string, page: number = 1, limit: number = 10) {
    await this.ensurePublishedCafe(cafeId);
    page = pageValue(page, 1);
    limit = pageValue(limit, 10, 50);
    const where = { cafeId, isHidden: false };
    const [data, total, summary] = await Promise.all([
      this.prisma.cafeReview.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        include: { user: { select: { displayName: true, email: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.cafeReview.count({ where }),
      this.summary(cafeId),
    ]);
    return {
      data: data.map((review) => serializeReview(review)),
      summary,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async getMine(userId: string, cafeId: string) {
    await this.ensurePublishedCafe(cafeId);
    const review = await this.prisma.cafeReview.findUnique({
      where: { userId_cafeId: { userId, cafeId } },
      include: { user: { select: { displayName: true, email: true } } },
    });
    return review ? serializeReview(review, userId) : null;
  }

  async listMine(userId: string, page: number = 1, limit: number = 5) {
    page = pageValue(page, 1);
    limit = pageValue(limit, 5, 20);
    const where = { userId, isHidden: false };
    const [data, total] = await Promise.all([
      this.prisma.cafeReview.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          cafe: {
            select: {
              id: true,
              name: true,
              slug: true,
              address: true,
              district: true,
              coverImage: true,
              isPublished: true,
            },
          },
        },
      }),
      this.prisma.cafeReview.count({ where }),
    ]);
    return {
      data: data.map(serializeProfileReview),
      total,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async upsert(userId: string, cafeId: string, dto: UpsertReviewDto) {
    await this.ensurePublishedCafe(cafeId);
    const data = this.normalize(dto);
    const review = await this.prisma.cafeReview.upsert({
      where: { userId_cafeId: { userId, cafeId } },
      create: { userId, cafeId, ...data },
      update: data,
      include: { user: { select: { displayName: true, email: true } } },
    });
    return serializeReview(review, userId);
  }

  async deleteMine(userId: string, cafeId: string) {
    await this.ensurePublishedCafe(cafeId);
    const result = await this.prisma.cafeReview.deleteMany({ where: { userId, cafeId } });
    return { deleted: result.count > 0 };
  }

  private async ensurePublishedCafe(cafeId: string) {
    const cafe = await this.prisma.cafe.findFirst({ where: { id: cafeId, isPublished: true } });
    if (!cafe) throw new NotFoundException('Cafe not found');
  }

  private async summary(cafeId: string) {
    const where = { cafeId, isHidden: false };
    const [reviewCount, ratings] = await Promise.all([
      this.prisma.cafeReview.count({ where }),
      this.prisma.cafeReview.aggregate({
        where: { ...where, rating: { not: null } },
        _count: { rating: true },
        _avg: { rating: true },
      }),
    ]);
    return {
      reviewCount,
      ratingCount: ratings._count.rating,
      averageRating: ratings._avg.rating ? Number(ratings._avg.rating.toFixed(2)) : null,
    };
  }

  private normalize(dto: UpsertReviewDto) {
    const content = typeof dto.content === 'string' ? dto.content.trim() : null;
    const rating = dto.rating ?? null;
    if (rating === null && !content) {
      throw new BadRequestException('Rating or content is required');
    }
    return { rating, content: content || null };
  }
}
