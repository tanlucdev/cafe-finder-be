import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type {} from 'multer';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { CreateSubmissionDto } from './dto/create-submission.dto';

type UploadedFile = Express.Multer.File;

function payloadObject(value: unknown) {
  return typeof value === 'object' && value ? (value as Record<string, unknown>) : {};
}

function filledString(value: unknown) {
  return typeof value === 'string' && Boolean(value.trim());
}

function validateOwnerPayload(submission: { name: string; address: string | null; googleMapsUrl: string | null; payload: unknown }) {
  const payload = payloadObject(submission.payload);
  const missing = [
    filledString(payload.name) || filledString(submission.name) ? null : 'name',
    Array.isArray(payload.images) && payload.images.length > 0 ? null : 'images',
    filledString(payload.address) || filledString(payload.googleMapsUrl) || filledString(submission.address) || filledString(submission.googleMapsUrl) ? null : 'location',
    filledString(payload.openingTime) ? null : 'openingTime',
    filledString(payload.closingTime) ? null : 'closingTime',
  ].filter(Boolean);
  if (missing.length) throw new BadRequestException(`Missing required owner payload: ${missing.join(', ')}`);
}

@Injectable()
export class SubmissionsService {
  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
  ) {}

  async create(userId: string, dto: CreateSubmissionDto) {
    return this.prisma.cafeSubmission.create({
      data: {
        submittedById: userId,
        submissionType: dto.submissionType ?? 'community',
        status: dto.submissionType === 'owner' ? 'draft' : 'pending',
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
    const submission = await this.prisma.cafeSubmission.findFirst({
      where: { id, submittedById: userId, status: 'draft', isHidden: false },
    });
    if (!submission) throw new NotFoundException(`Submission not found: ${id}`);

    const url = await this.storage.uploadImage(file, `submissions/${id}/${field}`);
    const payload = {
      ...(typeof submission.payload === 'object' && submission.payload ? submission.payload : {}),
    } as Record<string, unknown>;
    const urls = Array.isArray(payload[field]) ? (payload[field] as string[]) : [];
    payload[field] = [...urls, url];
    if (field === 'images') {
      payload.imageOrientations = [
        ...(Array.isArray(payload.imageOrientations) ? payload.imageOrientations : []),
        'unknown',
      ];
      payload.coverImage = typeof payload.coverImage === 'string' ? payload.coverImage : url;
      payload.coverImageCrop = payload.coverImageCrop ?? { x: 50, y: 50 };
    }

    return this.prisma.cafeSubmission.update({
      where: { id },
      data: { payload: payload as Prisma.InputJsonValue },
    });
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
