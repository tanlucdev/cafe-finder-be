import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CafeFilterDto } from './dto/cafe-filter.dto';
import { RouteDistanceService } from './route-distance.service';

type DistanceMode = 'straight' | 'route';

interface NearbyCafeRow {
  id: string;
  name: string;
  slug: string;
  address: string | null;
  district: string | null;
  priceMin: number | null;
  priceMax: number | null;
  oneLiner: string | null;
  parkingLocation: string | null;
  vibes: string[];
  purposes: string[];
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

@Injectable()
export class CafesService {
  constructor(
    private prisma: PrismaService,
    private routeDistance: RouteDistanceService,
  ) {}

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
          parkingLocation: true,
          vibes: true,
          purposes: true,
          isFeatured: true,
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
      throw new NotFoundException(`Cafe not found with slug: ${slug}`);
    }

    return cafe;
  }

  async findNearby(
    lat: number,
    lng: number,
    radiusKm: number = 2,
    distanceMode: DistanceMode = 'straight',
  ) {
    const radiusMeters = radiusKm * 1000;

    const result = await this.prisma.$queryRaw<NearbyCafeRow[]>`
      SELECT
        c.id, c.name, c.slug, c.address, c.district,
        c.price_min AS "priceMin", c.price_max AS "priceMax",
        c.one_liner AS "oneLiner",
        c.parking_location AS "parkingLocation",
        c.vibes, c.purposes,
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
      ...cafe,
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
        parkingLocation: true,
        vibes: true,
        purposes: true,
        coverImage: true,
        isFeatured: true,
        district: true,
      },
    });
  }
}
