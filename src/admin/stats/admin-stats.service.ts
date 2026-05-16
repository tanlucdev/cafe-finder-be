import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AdminStatsService {
  constructor(private prisma: PrismaService) {}

  async getStats() {
    const [total_cafes, published_cafes, featured_cafes, pending_submissions, total_users] =
      await Promise.all([
        this.prisma.cafe.count(),
        this.prisma.cafe.count({ where: { isPublished: true } }),
        this.prisma.cafe.count({ where: { isFeatured: true } }),
        this.prisma.cafeSubmission.count({ where: { status: 'pending' } }),
        this.prisma.user.count(),
      ]);

    return { total_cafes, published_cafes, featured_cafes, pending_submissions, total_users };
  }
}
