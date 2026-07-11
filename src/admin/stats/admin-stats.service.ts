import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AdminStatsService {
  constructor(private prisma: PrismaService) {}

  async getStats() {
    const total_cafes = await this.prisma.cafe.count();
    const published_cafes = await this.prisma.cafe.count({ where: { isPublished: true } });
    const featured_cafes = await this.prisma.cafe.count({ where: { isFeatured: true } });
    const pending_submissions = await this.prisma.cafeSubmission.count({
      where: { status: 'pending' },
    });
    const total_users = await this.prisma.user.count({ where: { isHidden: false } });

    return { total_cafes, published_cafes, featured_cafes, pending_submissions, total_users };
  }
}
