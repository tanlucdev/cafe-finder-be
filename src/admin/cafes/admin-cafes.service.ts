import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import slugify from 'slugify';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../storage/storage.service';
import { AdminCafeFilterDto } from './dto/admin-cafe-filter.dto';
import { CreateCafeDto } from './dto/create-cafe.dto';
import { UpdateCafeDto } from './dto/update-cafe.dto';

function parseTimeString(time: string | null | undefined): Date | null {
  if (!time) return null;
  const [hours, minutes] = time.split(':').map(Number);
  const d = new Date(0);
  d.setUTCHours(hours, minutes, 0, 0);
  return d;
}

@Injectable()
export class AdminCafesService {
  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
  ) {}

  async listCafes(filter: AdminCafeFilterDto) {
    const { district, is_published, is_featured, search, page = 1, limit = 20 } = filter;

    const where: any = {
      ...(district !== undefined && { district }),
      ...(is_published !== undefined && { isPublished: is_published }),
      ...(is_featured !== undefined && { isFeatured: is_featured }),
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
        orderBy: { createdAt: 'desc' },
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
          featuredOrder: true,
          isPublished: true,
          coverImage: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.cafe.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async getCafe(id: string) {
    return this.findCafeOrThrow(id);
  }

  async createCafe(dto: CreateCafeDto) {
    const { lat, lng, slug: dtoSlug, openingTime, closingTime, ...cafeData } = dto;
    const slug = dtoSlug || slugify(dto.name, { lower: true, locale: 'vi', strict: true });

    const cafe = await this.prisma.cafe.create({
      data: {
        ...cafeData,
        slug,
        ...(openingTime !== undefined && { openingTime: parseTimeString(openingTime) }),
        ...(closingTime !== undefined && { closingTime: parseTimeString(closingTime) }),
      },
    });

    if (lat != null && lng != null) {
      await this.prisma.$executeRaw`
        UPDATE cafes
        SET location = ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography
        WHERE id = ${cafe.id}::uuid
      `;
    }

    return cafe;
  }

  async updateCafe(id: string, dto: UpdateCafeDto) {
    await this.findCafeOrThrow(id);

    const { lat, lng, slug: dtoSlug, name, openingTime, closingTime, ...rest } = dto;
    const data: any = { ...rest };

    if (name) {
      data.name = name;
      if (!dtoSlug) {
        data.slug = slugify(name, { lower: true, locale: 'vi', strict: true });
      }
    }
    if (dtoSlug) data.slug = dtoSlug;
    if (openingTime !== undefined) data.openingTime = parseTimeString(openingTime);
    if (closingTime !== undefined) data.closingTime = parseTimeString(closingTime);

    const cafe = await this.prisma.cafe.update({ where: { id }, data });

    if (lat != null && lng != null) {
      await this.prisma.$executeRaw`
        UPDATE cafes
        SET location = ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography
        WHERE id = ${cafe.id}::uuid
      `;
    }

    return cafe;
  }

  async deleteCafe(id: string) {
    await this.findCafeOrThrow(id);
    return this.prisma.cafe.delete({ where: { id } });
  }

  async togglePublish(id: string) {
    const cafe = await this.findCafeOrThrow(id);
    return this.prisma.cafe.update({
      where: { id },
      data: { isPublished: !cafe.isPublished },
    });
  }

  async toggleFeature(id: string, featuredOrder?: number) {
    const cafe = await this.findCafeOrThrow(id);
    const isFeatured = !cafe.isFeatured;

    return this.prisma.cafe.update({
      where: { id },
      data: {
        isFeatured,
        ...(isFeatured && featuredOrder != null ? { featuredOrder } : {}),
        ...(!isFeatured ? { featuredOrder: null } : {}),
      },
    });
  }

  async uploadCafeImage(id: string, file: Express.Multer.File, setCover = false) {
    const cafe = await this.findCafeOrThrow(id);
    const url = await this.storage.uploadImage(file, `cafes/${id}`);

    const newImages = setCover ? [url, ...cafe.images] : [...cafe.images, url];
    const newOrientations = setCover
      ? ['unknown', ...(cafe.imageOrientations ?? [])]
      : [...(cafe.imageOrientations ?? []), 'unknown'];

    const updated = await this.prisma.cafe.update({
      where: { id },
      data: {
        images: newImages,
        imageOrientations: newOrientations,
        coverImage: setCover ? url : (cafe.coverImage ?? url),
      },
    });

    return {
      url,
      images: updated.images,
      imageOrientations: updated.imageOrientations,
      coverImage: updated.coverImage,
    };
  }

  async deleteCafeImage(id: string, imageUrl: string) {
    const cafe = await this.findCafeOrThrow(id);

    if (!cafe.images.includes(imageUrl)) {
      throw new BadRequestException('Image URL not found in this cafe');
    }

    await this.storage.deleteImage(imageUrl);

    const images = cafe.images.filter((url) => url !== imageUrl);
    const imageOrientations = (cafe.imageOrientations ?? []).filter(
      (_, index) => cafe.images[index] !== imageUrl,
    );
    const coverImage = cafe.coverImage === imageUrl ? (images[0] ?? null) : cafe.coverImage;

    return this.prisma.cafe.update({
      where: { id },
      data: { images, imageOrientations, coverImage },
    });
  }

  async reorderCafeImages(id: string, imageUrls: string[]) {
    const cafe = await this.findCafeOrThrow(id);

    if (imageUrls.length !== cafe.images.length) {
      throw new BadRequestException('Image order must include every existing image exactly once');
    }

    const requestedUrls = new Set(imageUrls);
    if (requestedUrls.size !== imageUrls.length) {
      throw new BadRequestException('Image order cannot contain duplicate URLs');
    }

    const existingUrls = new Set(cafe.images);
    const hasOnlyExistingImages = imageUrls.every((url) => existingUrls.has(url));
    if (!hasOnlyExistingImages) {
      throw new BadRequestException('Image order contains URLs that do not belong to this cafe');
    }

    const orientationsByUrl = new Map(
      cafe.images.map((url, index) => [url, cafe.imageOrientations?.[index] ?? 'unknown']),
    );
    const imageOrientations = imageUrls.map((url) => orientationsByUrl.get(url) ?? 'unknown');

    return this.prisma.cafe.update({
      where: { id },
      data: {
        images: imageUrls,
        imageOrientations,
        coverImage:
          cafe.coverImage && requestedUrls.has(cafe.coverImage)
            ? cafe.coverImage
            : (imageUrls[0] ?? null),
      },
    });
  }

  private async findCafeOrThrow(id: string) {
    const cafe = await this.prisma.cafe.findUnique({ where: { id } });
    if (!cafe) throw new NotFoundException(`Cafe not found: ${id}`);
    return cafe;
  }
}
