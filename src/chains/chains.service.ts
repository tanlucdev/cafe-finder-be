import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ChainsService {
  constructor(private readonly prisma: PrismaService) {}

  private where() {
    return { isPublished: true, isHidden: false };
  }

  private localized(chain: any, locale?: string) {
    return { ...chain, description: locale === 'en' && chain.descriptionEn ? chain.descriptionEn : chain.description };
  }

  async findAll(locale = 'vi', page = 1, limit = 12) {
    const safePage = Math.max(1, page); const safeLimit = Math.min(50, Math.max(1, limit));
    const chains = await this.prisma.chain.findMany({ orderBy: [{ name: 'asc' }, { id: 'asc' }], skip: (safePage - 1) * safeLimit, take: safeLimit, where: { cafes: { some: this.where() } }, include: { cafes: { where: this.where(), select: { coverImage: true }, orderBy: { viewCount: 'desc' }, take: 1 }, _count: { select: { cafes: { where: this.where() } } } } });
    const total = await this.prisma.chain.count({ where: { cafes: { some: this.where() } } });
    return { data: chains.map(({ _count, cafes, ...chain }) => ({ ...this.localized(chain, locale), coverImage: chain.coverImage ?? cafes[0]?.coverImage ?? null, branchCount: _count.cafes })), total, page: safePage, limit: safeLimit };
  }

  async findOne(slug: string, locale = 'vi') {
    const chain = await this.prisma.chain.findFirst({ where: { slug, cafes: { some: this.where() } }, include: { cafes: { where: this.where(), select: { district: true, districtEn: true, coverImage: true }, orderBy: { viewCount: 'desc' } } } });
    if (!chain) throw new NotFoundException('Chain not found');
    const districts = [...new Set(chain.cafes.flatMap((cafe) => [locale === 'en' ? cafe.districtEn : cafe.district].filter(Boolean)))];
    const { cafes, ...data } = chain;
    return { ...this.localized(data, locale), coverImage: data.coverImage ?? cafes.find((cafe) => cafe.coverImage)?.coverImage ?? null, branchCount: cafes.length, districts };
  }
}
