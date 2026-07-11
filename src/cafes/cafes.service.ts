import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CafeFilterDto } from './dto/cafe-filter.dto';
import { RouteDistanceService } from './route-distance.service';
import { serializeLocalizedCafe } from './cafe.mapper';
import {
  cafeListSelect,
  cafeOrderBy,
  DistanceMode,
  NearbyCafeRow,
  openNowWhere,
  priceRangeToFilter,
} from './cafes.helpers';
import { CafeVotesService } from './cafe-votes.service';

@Injectable()
export class CafesService {
  constructor(
    private prisma: PrismaService,
    private routeDistance: RouteDistanceService,
  ) {}

  async findAll(filter: CafeFilterDto) {
    const { locale, district, search, priceRange, vibes, purposes, tags } = filter;
    const { page = 1, limit = 12, sort, openNow } = filter;

    const and: any[] = [];
    if (district) {
      and.push({ OR: [{ district }, { districtEn: district }] });
    }
    if (search) {
      and.push({
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { nameEn: { contains: search, mode: 'insensitive' } },
          { address: { contains: search, mode: 'insensitive' } },
          { addressEn: { contains: search, mode: 'insensitive' } },
          { oneLiner: { contains: search, mode: 'insensitive' } },
          { oneLinerEn: { contains: search, mode: 'insensitive' } },
        ],
      });
    }
    if (vibes?.length) {
      and.push({ OR: [{ vibes: { hasSome: vibes } }, { vibesEn: { hasSome: vibes } }] });
    }
    if (purposes?.length) {
      and.push({
        OR: [{ purposes: { hasSome: purposes } }, { purposesEn: { hasSome: purposes } }],
      });
    }
    if (tags?.length) {
      and.push({ OR: [{ tags: { hasSome: tags } }, { tagsEn: { hasSome: tags } }] });
    }

    const where: any = {
      isPublished: true,
      ...(priceRange && priceRangeToFilter(priceRange)),
      ...(openNow && openNowWhere(this.prisma.cafe.fields.openingTime)),
      ...(and.length && { AND: and }),
    };

    if (!sort || sort === 'popular') return this.findAllPopular(where, locale, page, limit);

    const [cafes, total] = await Promise.all([
      this.prisma.cafe.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: cafeOrderBy(sort),
        select: cafeListSelect,
      }),
      this.prisma.cafe.count({ where }),
    ]);

    const data = cafes.map((cafe) => this.serializeListCafe(cafe, locale, 0));

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

  private async findAllPopular(
    where: any,
    locale: string | undefined,
    page: number,
    limit: number,
  ) {
    const [cafes, total] = await Promise.all([
      this.prisma.cafe.findMany({
        where,
        select: cafeListSelect,
      }),
      this.prisma.cafe.count({ where }),
    ]);
    const { start, end } = CafeVotesService.weekRange();
    const weekly = cafes.length
      ? await this.prisma.cafeVote.groupBy({
          by: ['cafeId'],
          where: {
            createdAt: { gte: start, lt: end },
            cafeId: { in: cafes.map((cafe) => cafe.id) },
          },
          _count: { cafeId: true },
        })
      : [];
    const weeklyByCafe = new Map(weekly.map((row) => [row.cafeId, row._count.cafeId]));
    const sorted = cafes
      .map((cafe) => ({ cafe, weeklyVoteCount: weeklyByCafe.get(cafe.id) ?? 0 }))
      .sort((a, b) => {
        return (
          b.weeklyVoteCount - a.weeklyVoteCount ||
          b.cafe._count.cafeVotes - a.cafe._count.cafeVotes ||
          Number(b.cafe.isFeatured) - Number(a.cafe.isFeatured) ||
          (a.cafe.featuredOrder ?? Number.MAX_SAFE_INTEGER) -
            (b.cafe.featuredOrder ?? Number.MAX_SAFE_INTEGER) ||
          b.cafe._count.savedCafes - a.cafe._count.savedCafes ||
          b.cafe.createdAt.getTime() - a.cafe.createdAt.getTime()
        );
      })
      .slice((page - 1) * limit, page * limit)
      .map(({ cafe, weeklyVoteCount }) => this.serializeListCafe(cafe, locale, weeklyVoteCount));

    return {
      data: sorted,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  private serializeListCafe(cafe: any, locale?: string, weeklyVoteCount = 0) {
    const { _count, ...rest } = cafe;
    return {
      ...serializeLocalizedCafe(rest, locale),
      savedCount: _count.savedCafes,
      voteCount: _count.cafeVotes,
      weeklyVoteCount,
    };
  }

  async findBySlug(slug: string, locale?: string) {
    const cafe = await this.prisma.cafe.findFirst({
      where: { slug, isPublished: true },
      include: { _count: { select: { savedCafes: true, cafeVotes: true } } },
    });

    if (!cafe) {
      throw new NotFoundException(`Cafe not found with slug: ${slug}`);
    }

    const { start, end } = CafeVotesService.weekRange();
    const weeklyVoteCount = await this.prisma.cafeVote.count({
      where: { cafeId: cafe.id, createdAt: { gte: start, lt: end } },
    });
    return this.serializeListCafe(cafe, locale, weeklyVoteCount);
  }

  async findNearby(
    lat: number,
    lng: number,
    radiusKm: number = 2,
    distanceMode: DistanceMode = 'straight',
    locale?: string,
  ) {
    const radiusMeters = radiusKm * 1000;

    const result = await this.prisma.$queryRaw<NearbyCafeRow[]>`
      SELECT
        c.id, c.name, c.name_en AS "nameEn", c.slug,
        c.address, c.address_en AS "addressEn",
        c.district, c.district_en AS "districtEn",
        c.opening_time AS "openingTime", c.closing_time AS "closingTime",
        c.price_min AS "priceMin", c.price_max AS "priceMax",
        c.one_liner AS "oneLiner", c.one_liner_en AS "oneLinerEn",
        c.parking_location AS "parkingLocation",
        c.parking_location_en AS "parkingLocationEn",
        c.vibes, c.vibes_en AS "vibesEn",
        c.purposes, c.purposes_en AS "purposesEn",
        c.amenities, c.amenities_en AS "amenitiesEn",
        c.tags, c.tags_en AS "tagsEn",
        c.cover_image AS "coverImage",
        ST_Y(c.location::geometry) AS lat,
        ST_X(c.location::geometry) AS lng,
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

    const straightResult = result.map((cafe) => ({
      ...serializeLocalizedCafe(cafe, locale),
      distanceMode: 'straight' as const,
      distance_mode: 'straight' as const,
    }));

    if (distanceMode !== 'route') return straightResult;

    const routes = await this.routeDistance.getDrivingDistances(
      { lat, lng },
      straightResult.map((cafe) => ({
        id: cafe.id,
        lat: Number(cafe.lat),
        lng: Number(cafe.lng),
      })),
    );

    if (!routes?.length) return straightResult;

    const routeById = new Map(routes.map((route) => [route.id, route]));
    return straightResult
      .map((cafe) => {
        const route = routeById.get(cafe.id);
        if (!route) return cafe;

        return {
          ...cafe,
          straight_distance_km: cafe.distance_km,
          distance_km: route.distanceKm,
          duration_min: route.durationMin,
          distanceMode: 'route' as const,
          distance_mode: 'route' as const,
        };
      })
      .sort((a, b) => Number(a.distance_km) - Number(b.distance_km));
  }

  async getDistricts(locale?: string) {
    const result = await this.prisma.cafe.findMany({
      where: { isPublished: true, district: { not: null } },
      select: { district: true, districtEn: true },
      distinct: ['district'],
      orderBy: { district: 'asc' },
    });

    return result
      .map((district) => serializeLocalizedCafe(district, locale).district)
      .filter(Boolean);
  }

  async quizMatch(vibes: string[], purposes: string[], locale?: string, tags: string[] = []) {
    const and: any[] = [];
    if (vibes?.length) {
      and.push({ OR: [{ vibes: { hasSome: vibes } }, { vibesEn: { hasSome: vibes } }] });
    }
    if (purposes?.length) {
      and.push({
        OR: [{ purposes: { hasSome: purposes } }, { purposesEn: { hasSome: purposes } }],
      });
    }
    if (tags?.length) {
      and.push({ OR: [{ tags: { hasSome: tags } }, { tagsEn: { hasSome: tags } }] });
    }

    const cafes = await this.prisma.cafe.findMany({
      where: {
        isPublished: true,
        ...(and.length && { AND: and }),
      },
      take: 10,
      orderBy: [{ isFeatured: 'desc' }, { featuredOrder: 'asc' }],
      select: {
        id: true,
        name: true,
        nameEn: true,
        slug: true,
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
        openingTime: true,
        closingTime: true,
        isFeatured: true,
        district: true,
        districtEn: true,
      },
    });

    return cafes.map((cafe) => serializeLocalizedCafe(cafe, locale));
  }
}
