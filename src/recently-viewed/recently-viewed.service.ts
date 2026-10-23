import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { serializeLocalizedCafe } from '../cafes/cafe.mapper';

const cafeSelect = {
  id: true,
  name: true,
  nameEn: true,
  slug: true,
  address: true,
  addressEn: true,
  district: true,
  districtEn: true,
  priceMin: true,
  priceMax: true,
  oneLiner: true,
  oneLinerEn: true,
  parkingLocation: true,
  parkingLocationEn: true,
  vibes: true,
  vibesEn: true,
  purposes: true,
  purposesEn: true,
  amenities: true,
  amenitiesEn: true,
  tags: true,
  tagsEn: true,
  coverImage: true,
  coverImageCrop: true,
};

@Injectable()
export class RecentlyViewedService {
  constructor(private readonly prisma: PrismaService) {}

  async recordView(userId: string, cafeId: string) {
    const lastViewedAt = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.recentlyViewedCafe.upsert({
        where: { userId_cafeId: { userId, cafeId } },
        update: { lastViewedAt },
        create: { userId, cafeId, lastViewedAt },
      });
      const overflow = await tx.recentlyViewedCafe.findMany({
        where: { userId },
        orderBy: { lastViewedAt: 'desc' },
        skip: 20,
        select: { id: true },
      });
      if (overflow.length) {
        await tx.recentlyViewedCafe.deleteMany({
          where: { id: { in: overflow.map((item) => item.id) } },
        });
      }
    });
  }

  async getRecentlyViewed(userId: string, locale?: string, limit = 20) {
    const rows = await this.prisma.recentlyViewedCafe.findMany({
      where: { userId, cafe: { isPublished: true, isHidden: false } },
      orderBy: { lastViewedAt: 'desc' },
      take: limit,
      select: { lastViewedAt: true, cafe: { select: cafeSelect } },
    });

    return rows.map((row) => ({
      cafe: serializeLocalizedCafe(row.cafe, locale),
      viewedAt: row.lastViewedAt,
    }));
  }
}
