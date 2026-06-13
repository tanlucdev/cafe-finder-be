import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CafeFilterDto } from './dto/cafe-filter.dto';
import { RouteDistanceService } from './route-distance.service';
import { serializeLocalizedCafe } from './cafe.mapper';

type DistanceMode = 'straight' | 'route';

interface NearbyCafeRow {
  id: string;
  name: string;
  nameEn: string | null;
  slug: string;
  address: string | null;
  addressEn: string | null;
  district: string | null;
  districtEn: string | null;
  openingTime: Date | string | null;
  closingTime: Date | string | null;
  priceMin: number | null;
  priceMax: number | null;
  oneLiner: string | null;
  oneLinerEn: string | null;
  parkingLocation: string | null;
  parkingLocationEn: string | null;
  vibes: string[];
  vibesEn: string[];
  purposes: string[];
  purposesEn: string[];
  amenities: string[];
  amenitiesEn: string[];
  tags: string[];
  tagsEn: string[];
  coverImage: string | null;
  lat: number;
  lng: number;
  distance_km: number | string;
  distanceMode?: DistanceMode;
  distance_mode?: DistanceMode;
  straight_distance_km?: number | string;
  duration_min?: number;
}

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

function cafeOrderBy(sort: CafeFilterDto['sort']): any[] {
  if (sort === 'rating') {
    return [
      { rating: { sort: 'desc', nulls: 'last' } },
      { isFeatured: 'desc' },
      { featuredOrder: { sort: 'asc', nulls: 'last' } },
      { createdAt: 'desc' },
    ];
  }

  if (sort === 'newest') {
    return [{ createdAt: 'desc' }];
  }

  return [
    { isFeatured: 'desc' },
    { featuredOrder: { sort: 'asc', nulls: 'last' } },
    { savedCafes: { _count: 'desc' } },
    { createdAt: 'desc' },
  ];
}

function getVietnamTimeAsDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);
  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === 'minute')?.value ?? 0);
  const date = new Date(0);
  date.setUTCHours(hour, minute, 0, 0);
  return date;
}

function openNowWhere(openingTimeField: any, now = getVietnamTimeAsDate()) {
  return {
    openingTime: { not: null },
    closingTime: { not: null },
    OR: [
      { closingTime: { equals: openingTimeField } },
      { AND: [{ openingTime: { lte: now } }, { closingTime: { gt: now } }] },
      {
        AND: [
          { closingTime: { lte: openingTimeField } },
          { OR: [{ openingTime: { lte: now } }, { closingTime: { gt: now } }] },
        ],
      },
    ],
  };
}

@Injectable()
export class CafesService {
  constructor(
    private prisma: PrismaService,
    private routeDistance: RouteDistanceService,
  ) {}

  async findAll(filter: CafeFilterDto) {
    const {
      locale,
      district,
      search,
      priceRange,
      vibes,
      purposes,
      tags,
      page = 1,
      limit = 12,
      sort,
      openNow,
    } = filter;

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

    const [cafes, total] = await Promise.all([
      this.prisma.cafe.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: cafeOrderBy(sort),
        select: {
          id: true,
          name: true,
          nameEn: true,
          slug: true,
          address: true,
          addressEn: true,
          district: true,
          districtEn: true,
          openingTime: true,
          closingTime: true,
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
          rating: true,
          isFeatured: true,
          featuredOrder: true,
          coverImage: true,
          createdAt: true,
          updatedAt: true,
          _count: { select: { savedCafes: true } },
        },
      }),
      this.prisma.cafe.count({ where }),
    ]);

    const data = cafes.map(({ _count, ...cafe }) => ({
      ...serializeLocalizedCafe(cafe, locale),
      savedCount: _count.savedCafes,
    }));

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

  async findBySlug(slug: string, locale?: string) {
    const cafe = await this.prisma.cafe.findUnique({
      where: { slug, isPublished: true },
    });

    if (!cafe) {
      throw new NotFoundException(`Cafe not found with slug: ${slug}`);
    }

    return serializeLocalizedCafe(cafe, locale);
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
