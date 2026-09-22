import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateReviewDto } from './dto/update-review.dto';

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

const serialize = (review: any) => ({
  id: review.id,
  cafeId: review.cafeId,
  rating: review.rating,
  content: review.content,
  authorName:
    review.user?.displayName?.trim() && !review.user.displayName.includes('@')
      ? review.user.displayName.trim()
      : maskEmail(review.user?.email),
  createdAt: review.createdAt,
  updatedAt: review.updatedAt,
  isHidden: review.isHidden,
  adminNote: review.adminNote,
  cafe: review.cafe,
});

@Injectable()
export class AdminReviewsService {
  constructor(private prisma: PrismaService) {}

  async list(
    hidden?: string,
    cafeId?: string,
    search?: string,
    page: number = 1,
    limit: number = 10,
  ) {
    page = pageValue(page, 1);
    limit = pageValue(limit, 10, 100);
    const q = search?.trim();
    const where = {
      ...(hidden === 'true' ? { isHidden: true } : hidden === 'false' ? { isHidden: false } : {}),
      ...(cafeId ? { cafeId } : {}),
      ...(q
        ? {
            OR: [
              { content: { contains: q, mode: 'insensitive' as const } },
              { user: { displayName: { contains: q, mode: 'insensitive' as const } } },
              { user: { email: { contains: q, mode: 'insensitive' as const } } },
              { cafe: { name: { contains: q, mode: 'insensitive' as const } } },
            ],
          }
        : {}),
    };
    const include = {
      user: { select: { displayName: true, email: true } },
      cafe: { select: { id: true, name: true, slug: true } },
    };
    const [data, total] = await Promise.all([
      this.prisma.cafeReview.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        include,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.cafeReview.count({ where }),
    ]);
    return {
      data: data.map(serialize),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async update(id: string, dto: UpdateReviewDto) {
    const exists = await this.prisma.cafeReview.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new NotFoundException('Review not found');
    const review = await this.prisma.cafeReview.update({
      where: { id },
      data: {
        ...(dto.isHidden !== undefined ? { isHidden: dto.isHidden } : {}),
        ...(dto.adminNote !== undefined ? { adminNote: dto.adminNote || null } : {}),
      },
      include: {
        user: { select: { displayName: true, email: true } },
        cafe: { select: { id: true, name: true, slug: true } },
      },
    });
    return serialize(review);
  }
}
