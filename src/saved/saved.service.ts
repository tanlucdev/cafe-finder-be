import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SaveCafeDto } from './dto/save-cafe.dto';

@Injectable()
export class SavedService {
  constructor(private prisma: PrismaService) {}

  async getSaved(userId: string) {
    return this.prisma.savedCafe.findMany({
      where: { userId },
      include: {
        cafe: {
          select: {
            id: true,
            name: true,
            slug: true,
            address: true,
            district: true,
            priceMin: true,
            priceMax: true,
            oneLiner: true,
            vibes: true,
            coverImage: true,
            isFeatured: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async save(userId: string, dto: SaveCafeDto) {
    const cafe = await this.prisma.cafe.findUnique({ where: { id: dto.cafeId } });
    if (!cafe) {
      throw new NotFoundException('Không tìm thấy quán');
    }

    try {
      return await this.prisma.savedCafe.create({
        data: {
          userId,
          cafeId: dto.cafeId,
          collectionName: dto.collectionName || 'Yêu thích',
        },
      });
    } catch (e: any) {
      if (e.code === 'P2002') {
        throw new ConflictException('Quán này đã được lưu');
      }
      throw e;
    }
  }

  async remove(userId: string, cafeId: string) {
    const saved = await this.prisma.savedCafe.findUnique({
      where: { userId_cafeId: { userId, cafeId } },
    });

    if (!saved) {
      throw new NotFoundException('Không tìm thấy quán trong danh sách đã lưu');
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
