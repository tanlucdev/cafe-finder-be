import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type {} from 'multer';
import slugify from 'slugify';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../storage/storage.service';
import { AdminCafeFilterDto } from './dto/admin-cafe-filter.dto';
import { CreateCafeDto } from './dto/create-cafe.dto';
import { UpdateCafeDto } from './dto/update-cafe.dto';
import { syncLocalizedArrays } from './localized-arrays';

type UploadedFile = Express.Multer.File;
const MAX_CAFE_IMAGES = 12;

function parseTimeString(time: string | null | undefined): Date | null {
  if (!time) return null;
  const [hours, minutes] = time.split(':').map(Number);
  const d = new Date(0);
  d.setUTCHours(hours, minutes, 0, 0);
  return d;
}

function normalizeFeaturedFields<
  T extends { isFeatured?: boolean | null; featuredOrder?: number | null },
>(data: T) {
  if (data.isFeatured === false) {
    data.featuredOrder = null;
  }

  return data;
}

@Injectable()
export class AdminCafesService {
  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
  ) {}

  async listCafes(filter: AdminCafeFilterDto) {
    const { district, is_published, is_featured, search, page = 1, limit = 20 } = filter;

    const and: any[] = [];
    if (district !== undefined) {
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

    const where: any = {
      ...(is_published !== undefined && { isPublished: is_published }),
      ...(is_featured !== undefined && { isFeatured: is_featured }),
      ...(and.length && { AND: and }),
    };

    const [data, total] = await Promise.all([
      this.prisma.cafe.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
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
          tags: true,
          tagsEn: true,
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
        ...syncLocalizedArrays(normalizeFeaturedFields(cafeData)),
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
    const data: any = syncLocalizedArrays(normalizeFeaturedFields({ ...rest }));

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

  async toggleFeature(id: string, featuredOrder?: number | null) {
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

  async uploadCafeImage(id: string, file: UploadedFile, setCover = false) {
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

  async uploadCafeMenuImage(id: string, file: UploadedFile) {
    await this.findCafeOrThrow(id);
    const url = await this.storage.uploadImage(file, `cafes/${id}/menu`);

    const updated = await this.prisma.cafe.update({
      where: { id },
      data: { menuImage: url },
    });

    return { url, menuImage: updated.menuImage };
  }

  async importCafeImagesFromUrls(id: string, urls: string[], setCover = false) {
    const cafe = await this.findCafeOrThrow(id);
    const normalizedUrls = urls.map((url) => url.trim()).filter(Boolean);
    if (!normalizedUrls.length) {
      throw new BadRequestException('At least one image URL is required');
    }

    const availableSlots = Math.max(MAX_CAFE_IMAGES - cafe.images.length, 0);
    if (availableSlots === 0) {
      throw new BadRequestException('Cafe image gallery already has 12 images');
    }

    const urlsToImport = normalizedUrls.slice(0, availableSlots);
    const failed = normalizedUrls.slice(availableSlots).map((url) => ({
      url,
      reason: 'Cafe image gallery already has 12 images',
    }));
    const imported: string[] = [];

    for (const url of urlsToImport) {
      try {
        imported.push(await this.storage.uploadImageFromUrl(url, `cafes/${id}`));
      } catch (error) {
        failed.push({ url, reason: (error as Error).message });
      }
    }

    if (!imported.length) {
      return {
        imported,
        failed,
        images: cafe.images,
        imageOrientations: cafe.imageOrientations ?? [],
        coverImage: cafe.coverImage,
      };
    }

    const images = setCover ? [...imported, ...cafe.images] : [...cafe.images, ...imported];
    const importedOrientations = imported.map(() => 'unknown');
    const imageOrientations = setCover
      ? [...importedOrientations, ...(cafe.imageOrientations ?? [])]
      : [...(cafe.imageOrientations ?? []), ...importedOrientations];

    const updated = await this.prisma.cafe.update({
      where: { id },
      data: {
        images,
        imageOrientations,
        coverImage: setCover ? imported[0] : (cafe.coverImage ?? imported[0]),
      },
    });

    return {
      imported,
      failed,
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
