import { createHash } from 'crypto';
import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CafeFilterDto } from './dto/cafe-filter.dto';
import { RouteDistanceService } from './route-distance.service';
import { serializeLocalizedCafe } from './cafe.mapper';
import {
  cafeListSelect,
  cafeOrderBy,
  DistanceMode,
  NearbyCafeRow,
  hoursWhere,
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

  async findAll(filter: CafeFilterDto, user?: { id: string }) {
    const { locale, district, districts, search, priceRange, vibes, purposes, tags, hours } =
      filter;
    const { page = 1, limit = 12, sort, openNow } = filter;

    const and: any[] = [];
    const selectedDistricts = districts?.length ? districts : district ? [district] : [];
    if (selectedDistricts.length) {
      and.push({
        OR: [{ district: { in: selectedDistricts } }, { districtEn: { in: selectedDistricts } }],
      });
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
    if (hours) and.push(hoursWhere(hours, this.prisma.cafe.fields.closingTime));

    const where: any = {
      isPublished: true,
      isHidden: false,
      ...(priceRange && priceRangeToFilter(priceRange)),
      ...(openNow && openNowWhere(this.prisma.cafe.fields.openingTime)),
      ...(and.length && { AND: and }),
    };

    if (!sort || sort === 'popular') return this.findAllPopular(where, locale, page, limit, user);

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
    const { totalByCafe } = await this.getVoteCountMaps(cafes.map((cafe) => cafe.id));

    const data = cafes.map((cafe) =>
      this.serializeListCafe(cafe, locale, 0, totalByCafe.get(cafe.id) ?? 0),
    );

    return gateCafePage(data, total, page, limit, user);
  }

  private async findAllPopular(
    where: any,
    locale: string | undefined,
    page: number,
    limit: number,
    user?: { id: string },
  ) {
    const [cafes, total] = await Promise.all([
      this.prisma.cafe.findMany({
        where,
        orderBy: cafeOrderBy('popular'),
        select: cafeListSelect,
      }),
      this.prisma.cafe.count({ where }),
    ]);
    const { weeklyByCafe, totalByCafe } = await this.getVoteCountMaps(cafes.map((cafe) => cafe.id));
    const data = cafes
      .sort(
        (a, b) =>
          (b.viewCount ?? 0) - (a.viewCount ?? 0) ||
          (weeklyByCafe.get(b.id) ?? 0) - (weeklyByCafe.get(a.id) ?? 0) ||
          (totalByCafe.get(b.id) ?? 0) - (totalByCafe.get(a.id) ?? 0) ||
          Number(b.isFeatured) - Number(a.isFeatured) ||
          (a.featuredOrder ?? Number.MAX_SAFE_INTEGER) -
            (b.featuredOrder ?? Number.MAX_SAFE_INTEGER) ||
          b._count.savedCafes - a._count.savedCafes ||
          b.createdAt.getTime() - a.createdAt.getTime(),
      )
      .slice((page - 1) * limit, page * limit)
      .map((cafe) =>
        this.serializeListCafe(
          cafe,
          locale,
          weeklyByCafe.get(cafe.id) ?? 0,
          totalByCafe.get(cafe.id) ?? 0,
        ),
      );

    return gateCafePage(data, total, page, limit, user);
  }

  private serializeListCafe(cafe: any, locale?: string, weeklyVoteCount = 0, voteCount = 0) {
    const { _count, ...rest } = cafe;
    return {
      ...serializeLocalizedCafe(rest, locale),
      savedCount: _count?.savedCafes ?? Number(cafe.savedCount ?? 0),
      viewCount: rest.viewCount ?? 0,
      voteCount,
      weeklyVoteCount,
    };
  }

  async trackView(cafeId: string, visitorKey: string) {
    const cafe = await this.prisma.cafe.findFirst({
      where: { id: cafeId, isPublished: true, isHidden: false },
      select: { id: true, viewCount: true },
    });

    if (!cafe) throw new NotFoundException(`Cafe not found with id: ${cafeId}`);

    const bucketStart = new Date(Math.floor(Date.now() / 86_400_000) * 86_400_000);
    const visitorKeyHash = createHash('sha256').update(visitorKey).digest('hex');

    try {
      const updated = await this.prisma.$transaction(async (tx) => {
        await tx.cafeViewEvent.create({
          data: { cafeId, visitorKeyHash, bucketStart },
        });
        return tx.cafe.update({
          where: { id: cafeId },
          data: { viewCount: { increment: 1 } },
          select: { viewCount: true },
        });
      });

      return { viewCount: updated.viewCount, counted: true };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const current = await this.prisma.cafe.findUnique({
          where: { id: cafeId },
          select: { viewCount: true },
        });
        return { viewCount: current?.viewCount ?? cafe.viewCount, counted: false };
      }
      throw error;
    }
  }

  private async getVoteCountMaps(cafeIds: string[]) {
    if (!cafeIds.length)
      return { weeklyByCafe: new Map<string, number>(), totalByCafe: new Map<string, number>() };
    const { start, end } = CafeVotesService.weekRange();
    try {
      const [weekly, total] = await Promise.all([
        this.prisma.cafeVote.groupBy({
          by: ['cafeId'],
          where: { createdAt: { gte: start, lt: end }, cafeId: { in: cafeIds } },
          _count: { cafeId: true },
        }),
        this.prisma.cafeVote.groupBy({
          by: ['cafeId'],
          where: { cafeId: { in: cafeIds } },
          _count: { cafeId: true },
        }),
      ]);

      return {
        weeklyByCafe: new Map(weekly.map((row) => [row.cafeId, row._count.cafeId])),
        totalByCafe: new Map(total.map((row) => [row.cafeId, row._count.cafeId])),
      };
    } catch {
      // ponytail: supports deployments before cafe_votes migration; remove after migrate deploy is guaranteed.
      return { weeklyByCafe: new Map<string, number>(), totalByCafe: new Map<string, number>() };
    }
  }

  async findBySlug(slug: string, locale?: string) {
    const cafe = await this.prisma.cafe.findFirst({
      where: { slug, isPublished: true, isHidden: false },
      include: { _count: { select: { savedCafes: true } } },
    });

    if (!cafe) {
      throw new NotFoundException(`Cafe not found with slug: ${slug}`);
    }

    const { weeklyByCafe, totalByCafe } = await this.getVoteCountMaps([cafe.id]);
    return this.serializeListCafe(
      cafe,
      locale,
      weeklyByCafe.get(cafe.id) ?? 0,
      totalByCafe.get(cafe.id) ?? 0,
    );
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
        c.cover_image_crop AS "coverImageCrop",
        c.menu_image AS "menuImage",
        c.menu_images AS "menuImages",
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
        AND c.is_hidden = false
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

  async findNearbyDiscovery(filter: CafeFilterDto, user?: { id: string }) {
    if (filter.lat == null || filter.lng == null) {
      throw new Error('Nearby discovery requires lat and lng');
    }

    const page = filter.page ?? 1;
    const limit = filter.limit ?? 12;
    const where = discoveryWhere(filter);
    const [{ total }] = await this.prisma.$queryRaw<{ total: bigint }[]>`
      SELECT COUNT(*)::bigint AS total FROM cafes c WHERE ${where}
    `;
    const count = Number(total);
    const pageStart = (page - 1) * limit;
    const readableOnPage = user
      ? Math.max(0, Math.min(limit, count - pageStart))
      : Math.max(0, Math.min(limit, count - pageStart, GUEST_VISIBLE_CAFES - pageStart));
    const rows = readableOnPage
      ? await this.prisma.$queryRaw<any[]>(
          discoveryPageQuery(filter, where, pageStart, readableOnPage),
        )
      : [];
    const cafes = rows.map((cafe) =>
      this.serializeListCafe(
        cafe,
        filter.locale,
        Number(cafe.weeklyVoteCount ?? 0),
        Number(cafe.voteCount ?? 0),
      ),
    );
    const data = await this.enrichDiscoveryRoutes(cafes, filter);
    return gateCafePage(data, count, page, limit, user);
  }

  private async enrichDiscoveryRoutes(cafes: any[], filter: CafeFilterDto) {
    const straight = cafes.map((cafe) => ({
      ...cafe,
      distanceMode: 'straight' as const,
      distance_mode: 'straight' as const,
    }));
    if (filter.distanceMode !== 'route' || !straight.length) return straight;

    const routes = await this.routeDistance.getDrivingDistances(
      { lat: filter.lat!, lng: filter.lng! },
      straight.map((cafe) => ({ id: cafe.id, lat: Number(cafe.lat), lng: Number(cafe.lng) })),
    );
    if (!routes?.length) return straight;

    const routeById = new Map(routes.map((route) => [route.id, route]));
    // Keep the SQL-selected order; route distance only enriches the selected page.
    return straight.map((cafe) => {
      const route = routeById.get(cafe.id);
      return route
        ? {
            ...cafe,
            straight_distance_km: cafe.distance_km,
            distance_km: route.distanceKm,
            duration_min: route.durationMin,
            distanceMode: 'route' as const,
            distance_mode: 'route' as const,
          }
        : cafe;
    });
  }

  async getDistricts(locale?: string) {
    const result = await this.prisma.cafe.findMany({
      where: { isPublished: true, isHidden: false, district: { not: null } },
      select: { district: true, districtEn: true },
      distinct: ['district'],
      orderBy: { district: 'asc' },
    });

    return result
      .map((district) => serializeLocalizedCafe(district, locale).district)
      .filter(Boolean);
  }

  async quizMatch(
    vibes: string[],
    purposes: string[],
    locale?: string,
    tags: string[] = [],
    limit?: string | number,
  ) {
    const parsedLimit = Number(limit);
    const normalizedLimit = Math.min(
      50,
      Math.max(1, Number.isFinite(parsedLimit) ? Math.trunc(parsedLimit) : 36),
    );
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
        isHidden: false,
        ...(and.length && { AND: and }),
      },
      take: normalizedLimit,
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
        coverImageCrop: true,
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

// ponytail: fifteen guest previews are current product policy; promote this to plan configuration only for multiple access tiers.
const GUEST_VISIBLE_CAFES = 15;

type CafePageMeta = {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  discovery?: {
    displayTotal: number;
    totalPages: number;
    teaserSlots: number;
    previewTotal: number;
  };
};

function gateCafePage<T>(
  data: T[],
  total: number,
  page: number,
  limit: number,
  user?: { id: string },
): { data: T[]; meta: CafePageMeta } {
  const totalPages = Math.ceil(total / limit);
  const meta = { total, page, limit, totalPages };
  if (user) return { data, meta };

  const pageStart = (page - 1) * limit;
  const visible = data.slice(0, Math.max(0, GUEST_VISIBLE_CAFES - pageStart));
  const pageCapacity = Math.max(0, Math.min(limit, total - (page - 1) * limit));
  return {
    data: visible,
    meta: {
      ...meta,
      discovery: {
        displayTotal: total,
        totalPages,
        teaserSlots: Math.max(0, pageCapacity - visible.length),
        previewTotal: GUEST_VISIBLE_CAFES,
      },
    },
  };
}

function discoveryWhere(filter: CafeFilterDto) {
  const parts: Prisma.Sql[] = [
    Prisma.sql`c.is_published = true`,
    Prisma.sql`c.location IS NOT NULL`,
  ];
  const radiusMeters = (filter.radius ?? 2) * 1000;
  parts.push(Prisma.sql`
    ST_DWithin(
      c.location,
      ST_SetSRID(ST_MakePoint(${filter.lng!}, ${filter.lat!}), 4326)::geography,
      ${radiusMeters}
    )
  `);
  const districts = filter.districts?.length
    ? filter.districts
    : filter.district
      ? [filter.district]
      : [];
  if (districts.length) {
    parts.push(
      Prisma.sql`(c.district IN (${Prisma.join(districts)}) OR c.district_en IN (${Prisma.join(districts)}))`,
    );
  }
  if (filter.search) {
    const search = `%${filter.search}%`;
    parts.push(Prisma.sql`(
      c.name ILIKE ${search} OR c.name_en ILIKE ${search} OR c.address ILIKE ${search}
      OR c.address_en ILIKE ${search} OR c.one_liner ILIKE ${search} OR c.one_liner_en ILIKE ${search}
    )`);
  }
  addDiscoveryArrayFilter(parts, 'vibes', filter.vibes);
  addDiscoveryArrayFilter(parts, 'purposes', filter.purposes);
  addDiscoveryArrayFilter(parts, 'tags', filter.tags);
  if (filter.priceRange) parts.push(discoveryPriceFilter(filter.priceRange));
  if (filter.hours === 'open_at_7') parts.push(Prisma.sql`c.opening_time = TIME '07:00:00'`);
  if (filter.hours === 'open_24h') parts.push(Prisma.sql`c.opening_time = c.closing_time`);
  if (filter.openNow) {
    parts.push(Prisma.sql`
        c.opening_time IS NOT NULL AND c.closing_time IS NOT NULL AND (
        c.opening_time = c.closing_time OR
        (c.closing_time > c.opening_time AND timezone('Asia/Ho_Chi_Minh', NOW())::time BETWEEN c.opening_time AND c.closing_time) OR
        (c.closing_time <= c.opening_time AND (timezone('Asia/Ho_Chi_Minh', NOW())::time >= c.opening_time OR timezone('Asia/Ho_Chi_Minh', NOW())::time < c.closing_time))
      )
    `);
  }
  return Prisma.join(parts, ' AND ');
}

function addDiscoveryArrayFilter(
  parts: Prisma.Sql[],
  column: 'vibes' | 'purposes' | 'tags',
  values?: string[],
) {
  if (!values?.length) return;
  const englishColumn = `${column}_en`;
  parts.push(Prisma.sql`(
    c.${Prisma.raw(column)} && ARRAY[${Prisma.join(values)}]::text[] OR
    c.${Prisma.raw(englishColumn)} && ARRAY[${Prisma.join(values)}]::text[]
  )`);
}

function discoveryPriceFilter(priceRange: string) {
  switch (priceRange) {
    case 'under_50k':
      return Prisma.sql`c.price_max <= 50000`;
    case 'price_50k_100k':
      return Prisma.sql`c.price_min >= 50000 AND c.price_max <= 100000`;
    case 'price_100k_150k':
      return Prisma.sql`c.price_min >= 100000 AND c.price_max <= 150000`;
    case 'above_150k':
      return Prisma.sql`c.price_min >= 150000`;
    default:
      return Prisma.empty;
  }
}

function discoveryOrder(sort: CafeFilterDto['sort']) {
  if (sort === 'rating')
    return Prisma.sql`c.rating DESC NULLS LAST, c.is_featured DESC, c.featured_order ASC NULLS LAST, c.created_at DESC`;
  if (sort === 'newest') return Prisma.sql`c.created_at DESC`;
  return Prisma.sql`
    c.view_count DESC, "weeklyVoteCount" DESC, "voteCount" DESC,
    c.is_featured DESC, c.featured_order ASC NULLS LAST, "savedCount" DESC, c.created_at DESC
  `;
}

function discoveryPageQuery(
  filter: CafeFilterDto,
  where: Prisma.Sql,
  offset: number,
  limit: number,
) {
  const point = Prisma.sql`ST_SetSRID(ST_MakePoint(${filter.lng!}, ${filter.lat!}), 4326)::geography`;
  const weekStart = Prisma.sql`date_trunc('week', NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh') AT TIME ZONE 'Asia/Ho_Chi_Minh'`;
  return Prisma.sql`
    SELECT
      c.id, c.name, c.name_en AS "nameEn", c.slug, c.address, c.address_en AS "addressEn",
      c.district, c.district_en AS "districtEn", c.opening_time AS "openingTime", c.closing_time AS "closingTime",
      c.price_min AS "priceMin", c.price_max AS "priceMax", c.one_liner AS "oneLiner", c.one_liner_en AS "oneLinerEn",
      c.parking_location AS "parkingLocation", c.parking_location_en AS "parkingLocationEn",
      c.vibes, c.vibes_en AS "vibesEn", c.purposes, c.purposes_en AS "purposesEn", c.amenities, c.amenities_en AS "amenitiesEn",
      c.tags, c.tags_en AS "tagsEn", c.cover_image AS "coverImage", c.cover_image_crop AS "coverImageCrop",
      c.menu_image AS "menuImage", c.menu_images AS "menuImages", c.rating, c.is_featured AS "isFeatured",
      c.featured_order AS "featuredOrder", c.view_count AS "viewCount", c.created_at AS "createdAt", c.updated_at AS "updatedAt",
      ST_Y(c.location::geometry) AS lat, ST_X(c.location::geometry) AS lng,
      ROUND((ST_Distance(c.location, ${point}) / 1000)::numeric, 2) AS distance_km,
      (SELECT COUNT(*)::int FROM saved_cafes s WHERE s.cafe_id = c.id) AS "savedCount",
      (SELECT COUNT(*)::int FROM cafe_votes v WHERE v.cafe_id = c.id) AS "voteCount",
      (SELECT COUNT(*)::int FROM cafe_votes v WHERE v.cafe_id = c.id AND v.created_at >= ${weekStart}) AS "weeklyVoteCount"
    FROM cafes c
    WHERE ${where}
    ORDER BY ${discoveryOrder(filter.sort)}
    LIMIT ${limit} OFFSET ${offset}
  `;
}
