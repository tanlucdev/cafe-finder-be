import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import slugify from 'slugify';
import { PrismaService } from '../../prisma/prisma.service';

function parseTimeString(time: unknown): Date | null {
  if (typeof time !== 'string' || !/^\d{2}:\d{2}$/.test(time)) return null;
  const [hours, minutes] = time.split(':').map(Number);
  if (hours > 23 || minutes > 59) return null;
  const d = new Date(0);
  d.setUTCHours(hours, minutes, 0, 0);
  return d;
}

function stringValue(payload: Record<string, unknown>, key: string) {
  const value = payload[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function numberValue(payload: Record<string, unknown>, key: string) {
  const value = Number(payload[key]);
  return Number.isFinite(value) ? value : undefined;
}

function stringArray(payload: Record<string, unknown>, key: string) {
  const value = payload[key];
  return Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === 'string' && Boolean(item.trim()))
        .map((item) => item.trim())
    : [];
}

function payloadObject(value: unknown) {
  return typeof value === 'object' && value ? (value as Record<string, unknown>) : {};
}

function cropValue(payload: Record<string, unknown>, hasImages: boolean) {
  const crop = payload.coverImageCrop;
  if (crop && typeof crop === 'object') return crop as Prisma.InputJsonObject;
  return hasImages ? { x: 50, y: 50 } : undefined;
}

function buildOwnerCafeDraftData(submission: any) {
  const payload = payloadObject(submission.payload);
  const name = stringValue(payload, 'name') ?? submission.name;
  const images = stringArray(payload, 'images');
  const menuImages = stringArray(payload, 'menuImages');
  const openingTime = parseTimeString(payload.openingTime);
  const closingTime = parseTimeString(payload.closingTime);

  return {
    lat: numberValue(payload, 'lat'),
    lng: numberValue(payload, 'lng'),
    data: {
      name,
      slug: slugify(name, { lower: true, locale: 'vi', strict: true }),
      address: stringValue(payload, 'address') ?? submission.address ?? undefined,
      district: stringValue(payload, 'district'),
      googleMapsUrl: stringValue(payload, 'googleMapsUrl') ?? submission.googleMapsUrl ?? undefined,
      ...(openingTime ? { openingTime } : {}),
      ...(closingTime ? { closingTime } : {}),
      priceMin: numberValue(payload, 'priceMin'),
      priceMax: numberValue(payload, 'priceMax'),
      oneLiner: stringValue(payload, 'oneLiner'),
      description: stringValue(payload, 'description'),
      parkingLocation: stringValue(payload, 'parkingLocation'),
      signatureDrink: stringValue(payload, 'signatureDrink'),
      instagramUrl: stringValue(payload, 'instagramUrl'),
      vibes: stringArray(payload, 'vibes'),
      purposes: stringArray(payload, 'purposes'),
      amenities: stringArray(payload, 'amenities'),
      tags: stringArray(payload, 'tags'),
      images,
      imageOrientations: stringArray(payload, 'imageOrientations'),
      coverImage: images[0],
      coverImageCrop: cropValue(payload, images.length > 0),
      menuImage: menuImages[0],
      menuImages,
      isPublished: false,
    },
  };
}

function buildCommunityCafeDraftData(submission: any) {
  return {
    lat: undefined,
    lng: undefined,
    data: {
      name: submission.name,
      slug: slugify(submission.name, { lower: true, locale: 'vi', strict: true }),
      address: submission.address ?? undefined,
      googleMapsUrl: submission.googleMapsUrl ?? undefined,
      description: typeof submission.note === 'string' && submission.note.trim() ? submission.note.trim() : undefined,
      vibes: [],
      purposes: [],
      amenities: [],
      tags: [],
      images: [],
      imageOrientations: [],
      menuImages: [],
      isPublished: false,
    },
  };
}

function buildCafeDraftData(submission: any) {
  return submission.submissionType === 'owner'
    ? buildOwnerCafeDraftData(submission)
    : buildCommunityCafeDraftData(submission);
}

@Injectable()
export class AdminSubmissionsService {
  constructor(private prisma: PrismaService) {}

  async listSubmissions(status?: string, page: number = 1, limit: number = 10, search?: string) {
    page = Number.isInteger(page) && page > 0 ? page : 1;
    limit = Number.isInteger(limit) && limit > 0 ? Math.min(limit, 100) : 10;
    const q = search?.trim();
    const visibleStatuses = ['pending', 'approved', 'rejected'];
    const where = {
      isHidden: false,
      ...(visibleStatuses.includes(status ?? '')
        ? { status: status as any }
        : { status: { in: visibleStatuses as any } }),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: 'insensitive' as const } },
              { address: { contains: q, mode: 'insensitive' as const } },
              { submittedBy: { email: { contains: q, mode: 'insensitive' as const } } },
              { submittedBy: { displayName: { contains: q, mode: 'insensitive' as const } } },
            ],
          }
        : {}),
    };
    const [data, total] = await Promise.all([
      this.prisma.cafeSubmission.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        include: {
          submittedBy: {
            select: { id: true, email: true, displayName: true },
          },
          createdCafe: {
            select: { id: true, name: true, slug: true, isPublished: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.cafeSubmission.count({ where }),
    ]);
    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async getSubmission(id: string) {
    const submission = await this.prisma.cafeSubmission.findUnique({
      where: { id },
      include: {
        submittedBy: { select: { id: true, email: true, displayName: true } },
        createdCafe: { select: { id: true, name: true, slug: true, isPublished: true } },
      },
    });
    if (!submission || submission.isHidden || submission.status === 'draft')
      throw new NotFoundException(`Submission not found: ${id}`);
    return submission;
  }

  async approveSubmission(id: string, note?: string) {
    const submission = await this.prisma.cafeSubmission.findUnique({ where: { id } });
    if (!submission || submission.isHidden)
      throw new NotFoundException(`Submission not found: ${id}`);
    if (submission.status !== 'pending')
      throw new ConflictException(`Submission is already ${submission.status}`);

    const reviewNote = note?.trim();
    const draft = buildCafeDraftData(submission);

    return this.prisma.$transaction(async (tx) => {
      const claim = await tx.cafeSubmission.updateMany({
        where: { id, status: 'pending', isHidden: false },
        data: { status: 'approved' },
      });
      if (claim.count !== 1) {
        const current = await tx.cafeSubmission.findUnique({ where: { id } });
        if (!current || current.isHidden)
          throw new NotFoundException(`Submission not found: ${id}`);
        throw new ConflictException(`Submission is already ${current.status}`);
      }
      const cafe = await tx.cafe.create({
        data: draft.data,
      });
      if (draft.lat != null && draft.lng != null) {
        await tx.$executeRaw`
          UPDATE cafes
          SET location = ST_SetSRID(ST_MakePoint(${draft.lng}, ${draft.lat}), 4326)::geography
          WHERE id = ${cafe.id}::uuid
        `;
      }
      const updatedSubmission = await tx.cafeSubmission.update({
        where: { id },
        data: {
          status: 'approved',
          createdCafeId: cafe.id,
          ...(note !== undefined ? { reviewNote: reviewNote || null } : {}),
        },
      });

      return { submission: updatedSubmission, cafe };
    });
  }

  async rejectSubmission(id: string, note?: string) {
    const submission = await this.prisma.cafeSubmission.findUnique({ where: { id } });
    if (!submission || submission.isHidden || submission.status === 'draft')
      throw new NotFoundException(`Submission not found: ${id}`);
    if (submission.status !== 'pending')
      throw new ConflictException(`Submission is already ${submission.status}`);
    const reviewNote = note?.trim();

    return this.prisma.cafeSubmission.update({
      where: { id },
      data: {
        status: 'rejected',
        ...(note !== undefined ? { reviewNote: reviewNote || null } : {}),
      },
    });
  }

  async hideSubmission(id: string) {
    const submission = await this.prisma.cafeSubmission.findUnique({
      where: { id },
      select: { id: true, isHidden: true },
    });
    if (!submission || submission.isHidden)
      throw new NotFoundException(`Submission not found: ${id}`);

    return this.prisma.cafeSubmission.update({
      where: { id },
      data: { isHidden: true },
    });
  }
}
