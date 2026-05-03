import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CafeFilterDto } from './dto/cafe-filter.dto';

function priceRangeToFilter(priceRange: string): object {
  switch (priceRange) {
    case 'under_50k':
      return { priceMax: { lte: 50000 } };
    case 'price_50k_100k':
      return { priceMin: { gte: 50000 }, priceMax: { lte: 100000 } };
    case 'price_100k_150k':
      return { priceMin: { gte: 100000 }, priceMax: { lte: 150000 } };
    case 'above_150k':
      return { priceMin: { gte: 150000 } };
    default:
      return {};
  }
}

@Injectable()
export class CafesService {
  constructor(private prisma: PrismaService) {}

  async findAll(filter: CafeFilterDto) {
    const { district, search, priceRange, vibes, purposes, page = 1, limit = 12 } = filter;

    const where: any = {
      isPublished: true,
      ...(district && { district }),
      ...(priceRange && priceRangeToFilter(priceRange)),
      ...(vibes?.length && { vibes: { hasSome: vibes } }),
      ...(purposes?.length && { purposes: { hasSome: purposes } }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { address: { contains: search, mode: 'insensitive' } },
          { oneLiner: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.cafe.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ isFeatured: 'desc' }, { createdAt: 'desc' }],
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
          purposes: true,
          isFeatured: true,
          images: true,
          imageOrientations: true,
          coverImage: true,
        },
      }),
      this.prisma.cafe.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findBySlug(slug: string) {
    const cafe = await this.prisma.cafe.findUnique({
      where: { slug, isPublished: true },
    });

    if (!cafe) {
      throw new NotFoundException(`Không tìm thấy quán với slug: ${slug}`);
    }

    return cafe;
  }

  async findNearby(lat: number, lng: number, radiusKm: number = 2) {
    const radiusMeters = radiusKm * 1000;

    const result = await this.prisma.$queryRaw<any[]>`
      SELECT
        c.id, c.name, c.slug, c.address, c.district,
        c.price_min AS "priceMin", c.price_max AS "priceMax",
        c.one_liner AS "oneLiner",
        c.vibes, c.purposes,
        c.images,
        c.image_orientations AS "imageOrientations",
        c.cover_image AS "coverImage",
        ROUND(
          (ST_Distance(
            c.location,
            ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography
          ) / 1000)::numeric,
          2
        ) AS distance_km
      FROM cafes c
      WHERE
        c.is_published = true
        AND c.location IS NOT NULL
        AND ST_DWithin(
          c.location,
          ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography,
          ${radiusMeters}
        )
      ORDER BY distance_km ASC
      LIMIT 20
    `;

    return result;
  }

  async getDistricts() {
    const result = await this.prisma.cafe.findMany({
      where: { isPublished: true, district: { not: null } },
      select: { district: true },
      distinct: ['district'],
      orderBy: { district: 'asc' },
    });

    return result.map((r) => r.district).filter(Boolean);
  }

  async quizMatch(vibes: string[], purposes: string[]) {
    return this.prisma.cafe.findMany({
      where: {
        isPublished: true,
        ...(vibes?.length && { vibes: { hasSome: vibes } }),
        ...(purposes?.length && { purposes: { hasSome: purposes } }),
      },
      take: 10,
      orderBy: [{ isFeatured: 'desc' }, { featuredOrder: 'asc' }],
      select: {
        id: true,
        name: true,
        slug: true,
        oneLiner: true,
        vibes: true,
        purposes: true,
        images: true,
        imageOrientations: true,
        coverImage: true,
        isFeatured: true,
        district: true,
      },
    });
  }
}
