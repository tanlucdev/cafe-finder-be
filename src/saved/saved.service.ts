import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SaveCafeDto } from './dto/save-cafe.dto';
import { serializeLocalizedCafe } from '../cafes/cafe.mapper';

@Injectable()
export class SavedService {
  constructor(private prisma: PrismaService) {}

  async getSaved(userId: string, locale?: string) {
    const saved = await this.prisma.savedCafe.findMany({
      where: { userId },
      include: {
        cafe: {
          select: {
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
            coverImage: true,
            isFeatured: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return saved.map((item) => ({
      ...item,
      cafe: serializeLocalizedCafe(item.cafe, locale),
    }));
  }

  async save(userId: string, dto: SaveCafeDto) {
    const cafe = await this.prisma.cafe.findUnique({ where: { id: dto.cafeId } });
    if (!cafe) {
      throw new NotFoundException('Cafe not found');
    }

    try {
      return await this.prisma.savedCafe.create({
        data: {
          userId,
          cafeId: dto.cafeId,
          collectionName: dto.collectionName || 'Favorites',
        },
      });
    } catch (e: any) {
      if (e.code === 'P2002') {
        throw new ConflictException('Cafe is already saved');
      }
      throw e;
    }
  }

  async remove(userId: string, cafeId: string) {
    const saved = await this.prisma.savedCafe.findUnique({
      where: { userId_cafeId: { userId, cafeId } },
    });

    if (!saved) {
      throw new NotFoundException('Cafe not found in saved list');
    }

    return this.prisma.savedCafe.delete({
      where: { userId_cafeId: { userId, cafeId } },
    });
  }

  async getCollections(userId: string) {
    const result = await this.prisma.savedCafe.findMany({
      where: { userId },
      select: { collectionName: true },
      distinct: ['collectionName'],
      orderBy: { collectionName: 'asc' },
    });

    return result.map((r) => r.collectionName);
  }
}
