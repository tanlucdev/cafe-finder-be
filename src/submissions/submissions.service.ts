import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {} from 'multer';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { CreateSubmissionDto } from './dto/create-submission.dto';

type UploadedFile = Express.Multer.File;

const MAX_OWNER_GALLERY_IMAGES = 12;
const OWNER_GALLERY_IMAGE_LIMIT_MESSAGE = `Owner gallery allows at most ${MAX_OWNER_GALLERY_IMAGES} images`;

function payloadObject(value: unknown) {
  return typeof value === 'object' && value ? (value as Record<string, unknown>) : {};
}

function filledString(value: unknown) {
  return typeof value === 'string' && Boolean(value.trim());
}

function imageCount(payload: unknown) {
  const images = payloadObject(payload).images;
  return Array.isArray(images) ? images.length : 0;
}

function validateOwnerGalleryImageCount(submissionType: string | undefined, payload: unknown) {
  if (submissionType === 'owner' && imageCount(payload) > MAX_OWNER_GALLERY_IMAGES)
    throw new BadRequestException(OWNER_GALLERY_IMAGE_LIMIT_MESSAGE);
}

function validateOwnerGalleryUpload(
  submission: { submissionType?: string; payload: unknown },
  fileCount: number,
  field: 'images' | 'menuImages',
) {
  if (
    field === 'images' &&
    submission.submissionType === 'owner' &&
    imageCount(submission.payload) + fileCount > MAX_OWNER_GALLERY_IMAGES
  )
    throw new BadRequestException(OWNER_GALLERY_IMAGE_LIMIT_MESSAGE);
}

async function mapLimit<T, U>(
  items: T[],
  limit: number,
  mapper: (item: T, index: number) => Promise<U>,
) {
  const results = new Array<U>(items.length);
  let nextIndex = 0;
  let firstError: unknown;
  async function worker() {
    while (nextIndex < items.length && !firstError) {
      const index = nextIndex;
      nextIndex += 1;
      try {
        results[index] = await mapper(items[index], index);
      } catch (error) {
        firstError = error;
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  if (firstError) throw firstError;
  return results;
}

function validateOwnerPayload(submission: {
  name: string;
  address: string | null;
  googleMapsUrl: string | null;
  payload: unknown;
}) {
  const payload = payloadObject(submission.payload);
  validateOwnerGalleryImageCount('owner', payload);
  const missing = [
    filledString(payload.name) || filledString(submission.name) ? null : 'name',
    Array.isArray(payload.images) && payload.images.length > 0 ? null : 'images',
    filledString(payload.address) ||
    filledString(payload.googleMapsUrl) ||
    filledString(submission.address) ||
    filledString(submission.googleMapsUrl)
      ? null
      : 'location',
    filledString(payload.openingTime) ? null : 'openingTime',
    filledString(payload.closingTime) ? null : 'closingTime',
  ].filter(Boolean);
  if (missing.length)
    throw new BadRequestException(`Missing required owner payload: ${missing.join(', ')}`);
}

@Injectable()
export class SubmissionsService {
  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
  ) {}

  async create(userId: string, dto: CreateSubmissionDto) {
    const submissionType = dto.submissionType ?? 'community';
    validateOwnerGalleryImageCount(submissionType, dto.payload);
    return this.prisma.cafeSubmission.create({
      data: {
        submittedById: userId,
        submissionType,
        status: submissionType === 'owner' ? 'draft' : 'pending',
        name: dto.name,
        address: dto.address,
        googleMapsUrl: dto.googleMapsUrl,
        note: dto.note,
        payload: (dto.payload ?? null) as Prisma.InputJsonValue,
      },
    });
  }

  async update(userId: string, id: string, dto: CreateSubmissionDto) {
    const submission = await this.prisma.cafeSubmission.findFirst({
      where: { id, submittedById: userId, status: 'draft', isHidden: false },
      select: { id: true, submissionType: true },
    });
    if (!submission) throw new NotFoundException(`Submission not found: ${id}`);
    validateOwnerGalleryImageCount(submission.submissionType, dto.payload);

    return this.prisma.cafeSubmission.update({
      where: { id },
      data: {
        name: dto.name,
        submissionType: submission.submissionType,
        address: dto.address,
        googleMapsUrl: dto.googleMapsUrl,
        note: dto.note,
        payload: (dto.payload ?? null) as Prisma.InputJsonValue,
      },
    });
  }

  async uploadImage(
    userId: string,
    id: string,
    file: UploadedFile,
    field: 'images' | 'menuImages',
  ) {
    return this.uploadImages(userId, id, [file], field);
  }

  async uploadImages(
    userId: string,
    id: string,
    files: UploadedFile[],
    field: 'images' | 'menuImages',
  ) {
    const submission = await this.prisma.cafeSubmission.findFirst({
      where: { id, submittedById: userId, status: 'draft', isHidden: false },
    });
    if (!submission) throw new NotFoundException(`Submission not found: ${id}`);
    validateOwnerGalleryUpload(submission, files.length, field);

    const uploadedUrls: string[] = [];
    try {
      const newUrls = await mapLimit(files, 2, async (file) => {
        const url = await this.storage.uploadImage(file, `submissions/${id}/${field}`);
        uploadedUrls.push(url);
        return url;
      });

      return await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw(
          Prisma.sql`SELECT 1 FROM "cafe_submissions" WHERE "id" = CAST(${id} AS uuid) FOR UPDATE`,
        );
        const latest = await tx.cafeSubmission.findFirst({
          where: { id, submittedById: userId, status: 'draft', isHidden: false },
        });
        if (!latest) throw new NotFoundException(`Submission not found: ${id}`);
        validateOwnerGalleryUpload(latest, newUrls.length, field);
        const payload = payloadObject(latest.payload);
        const urls = Array.isArray(payload[field]) ? (payload[field] as string[]) : [];
        payload[field] = [...urls, ...newUrls];
        if (field === 'images') {
          payload.imageOrientations = [
            ...(Array.isArray(payload.imageOrientations) ? payload.imageOrientations : []),
            ...newUrls.map(() => 'unknown'),
          ];
          payload.coverImage =
            typeof payload.coverImage === 'string' ? payload.coverImage : newUrls[0];
          payload.coverImageCrop = payload.coverImageCrop ?? { x: 50, y: 50 };
        }

        return tx.cafeSubmission.update({
          where: { id },
          data: { payload: payload as Prisma.InputJsonValue },
        });
      });
    } catch (error) {
      await Promise.allSettled(uploadedUrls.map((url) => this.storage.deleteImage(url)));
      throw error;
    }
  }

  async submit(userId: string, id: string) {
    const submission = await this.prisma.cafeSubmission.findFirst({
      where: { id, submittedById: userId, status: 'draft', isHidden: false },
    });
    if (!submission) throw new NotFoundException(`Submission not found: ${id}`);
    if (submission.submissionType === 'owner') validateOwnerPayload(submission);

    return this.prisma.cafeSubmission.update({
      where: { id },
      data: { status: 'pending' },
    });
  }

  async getMe(userId: string) {
    return this.prisma.cafeSubmission.findMany({
      where: { submittedById: userId, isHidden: false },
      orderBy: { createdAt: 'desc' },
      include: {
        createdCafe: {
          select: {
            id: true,
            name: true,
            slug: true,
            address: true,
            district: true,
            coverImage: true,
            isPublished: true,
          },
        },
      },
    });
  }
}
