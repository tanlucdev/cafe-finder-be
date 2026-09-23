import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { cloudinaryPublicIdFromUrl, signCloudinaryParams } from '../storage/storage.service';

const MAX_OWNER_GALLERY_IMAGES = 12;
type AssetField = 'images' | 'menuImages';
type SignatureRequest = { field: AssetField };

function payloadObject(value: unknown) {
  return typeof value === 'object' && value ? (value as Record<string, unknown>) : {};
}

function imagesIn(payload: unknown) {
  const images = payloadObject(payload).images;
  return Array.isArray(images) ? images.length : 0;
}

function field(value: unknown): AssetField {
  if (value === 'images' || value === 'menuImages') return value;
  throw new BadRequestException('Asset field must be images or menuImages');
}

@Injectable()
export class SubmissionAssetsService {
  private readonly cloudName: string;
  private readonly apiKey: string;
  private readonly apiSecret: string;
  private readonly preset: string;

  constructor(
    private prisma: PrismaService,
    config: ConfigService,
  ) {
    this.cloudName = config.get('CLOUDINARY_CLOUD_NAME', '');
    this.apiKey = config.get('CLOUDINARY_API_KEY', '');
    this.apiSecret = config.get('CLOUDINARY_API_SECRET', '');
    this.preset = config.get('CLOUDINARY_OWNER_UPLOAD_PRESET', '');
  }

  async signatures(userId: string, id: string, requests: SignatureRequest[]) {
    if (!Array.isArray(requests) || !requests.length || requests.length > MAX_OWNER_GALLERY_IMAGES)
      throw new BadRequestException('Provide 1 to 12 assets');
    this.configured();
    const assets = requests.map(({ field: requestedField }) => ({ field: field(requestedField) }));
    const timestamp = String(Math.floor(Date.now() / 1000));

    return this.prisma.$transaction(async (tx) => {
      await this.lock(tx, id);
      const submission = await tx.cafeSubmission.findFirst({
        where: {
          id,
          submittedById: userId,
          submissionType: 'owner',
          status: 'draft',
          isHidden: false,
        },
      });
      if (!submission) throw new NotFoundException(`Submission not found: ${id}`);

      const requestedImages = assets.filter((asset) => asset.field === 'images').length;
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
      const signedImages = await tx.submissionAsset.count({
        where: {
          submissionId: id,
          field: 'images',
          status: 'signed',
          expiresAt: { gt: new Date() },
        },
      });
      if (imagesIn(submission.payload) + signedImages + requestedImages > MAX_OWNER_GALLERY_IMAGES)
        throw new BadRequestException(
          `Owner gallery allows at most ${MAX_OWNER_GALLERY_IMAGES} images`,
        );

      const signed = assets.map((asset) => {
        const folder = `submissions/${id}/${asset.field}`;
        const publicId = `${folder}/${randomUUID()}`;
        const params = {
          folder,
          public_id: publicId.slice(folder.length + 1),
          timestamp,
          overwrite: 'false',
          upload_preset: this.preset,
        };
        return {
          field: asset.field,
          publicId,
          params,
          signature: signCloudinaryParams(params, this.apiSecret),
        };
      });
      await tx.submissionAsset.createMany({
        data: signed.map(({ field: assetField, publicId }) => ({
          submissionId: id,
          field: assetField,
          publicId,
          expiresAt,
        })),
      });
      return {
        cloudName: this.cloudName,
        apiKey: this.apiKey,
        assets: signed.map(({ params, signature }) => ({ params, signature })),
      };
    });
  }

  async persist(userId: string, id: string, input: { secure_url?: unknown; public_id?: unknown }) {
    const secureUrl = typeof input.secure_url === 'string' ? input.secure_url : '';
    const publicId = typeof input.public_id === 'string' ? input.public_id : '';
    if (!secureUrl || !publicId)
      throw new BadRequestException('secureUrl and publicId are required');

    return this.prisma.$transaction(async (tx) => {
      await this.lock(tx, id);
      const submission = await tx.cafeSubmission.findFirst({
        where: {
          id,
          submittedById: userId,
          submissionType: 'owner',
          status: 'draft',
          isHidden: false,
        },
      });
      if (!submission) throw new NotFoundException(`Submission not found: ${id}`);
      const asset = await tx.submissionAsset.findFirst({ where: { submissionId: id, publicId } });
      if (!asset) throw new BadRequestException('Asset was not signed for this draft');
      if (asset.status === 'signed' && asset.expiresAt <= new Date())
        throw new BadRequestException('Asset signature has expired');
      this.validUrl(secureUrl, id, field(asset.field), publicId);
      if (asset.secureUrl) {
        if (asset.secureUrl !== secureUrl)
          throw new BadRequestException('Asset URL does not match');
        return submission;
      }
      if (asset.field === 'images' && imagesIn(submission.payload) >= MAX_OWNER_GALLERY_IMAGES)
        throw new BadRequestException(
          `Owner gallery allows at most ${MAX_OWNER_GALLERY_IMAGES} images`,
        );

      const payload = payloadObject(submission.payload);
      const urls = Array.isArray(payload[asset.field]) ? (payload[asset.field] as string[]) : [];
      payload[asset.field] = [...urls, secureUrl];
      if (asset.field === 'images') {
        payload.imageOrientations = [
          ...(Array.isArray(payload.imageOrientations) ? payload.imageOrientations : []),
          'unknown',
        ];
        payload.coverImage =
          typeof payload.coverImage === 'string' ? payload.coverImage : secureUrl;
        payload.coverImageCrop = payload.coverImageCrop ?? { x: 50, y: 50 };
      }
      await tx.submissionAsset.update({
        where: { id: asset.id },
        data: { secureUrl, status: 'persisted' },
      });
      return tx.cafeSubmission.update({
        where: { id },
        data: { payload: payload as Prisma.InputJsonValue },
      });
    });
  }

  async remove(userId: string, id: string, publicId: unknown) {
    if (typeof publicId !== 'string') throw new BadRequestException('publicId is required');
    const asset = await this.prisma.submissionAsset.findFirst({
      where: {
        submissionId: id,
        publicId,
        submission: { submittedById: userId, status: 'draft', isHidden: false },
      },
    });
    if (!asset) throw new NotFoundException(`Asset not found: ${id}`);
    this.validPublicId(publicId, id, field(asset.field));
    await this.destroy(publicId);

    return this.prisma.$transaction(async (tx) => {
      await this.lock(tx, id);
      const submission = await tx.cafeSubmission.findFirst({
        where: {
          id,
          submittedById: userId,
          submissionType: 'owner',
          status: 'draft',
          isHidden: false,
        },
      });
      if (!submission) throw new NotFoundException(`Submission not found: ${id}`);
      const latest = await tx.submissionAsset.findFirst({
        where: { id: asset.id, submissionId: id },
      });
      if (!latest) return submission;
      const payload = payloadObject(submission.payload);
      if (latest.secureUrl && Array.isArray(payload[latest.field]))
        payload[latest.field] = (payload[latest.field] as string[]).filter(
          (url) => url !== latest.secureUrl,
        );
      if (latest.field === 'images') {
        const images = Array.isArray(payload.images) ? payload.images : [];
        payload.imageOrientations = (
          Array.isArray(payload.imageOrientations) ? payload.imageOrientations : []
        ).slice(0, images.length);
        payload.coverImage = images[0];
        payload.coverImageCrop = images[0] ? (payload.coverImageCrop ?? { x: 50, y: 50 }) : null;
      }
      await tx.submissionAsset.delete({ where: { id: latest.id } });
      return tx.cafeSubmission.update({
        where: { id },
        data: { payload: payload as Prisma.InputJsonValue },
      });
    });
  }

  private configured() {
    if (!this.cloudName || !this.apiKey || !this.apiSecret || !this.preset)
      throw new InternalServerErrorException('Cloudinary owner upload is not configured');
  }

  private async lock(tx: Prisma.TransactionClient, id: string) {
    await tx.$queryRaw(
      Prisma.sql`SELECT 1 FROM "cafe_submissions" WHERE "id" = CAST(${id} AS uuid) FOR UPDATE`,
    );
  }

  private validUrl(secureUrl: string, id: string, assetField: AssetField, publicId: string) {
    try {
      const url = new URL(secureUrl);
      if (
        url.search ||
        url.hash ||
        url.hostname !== 'res.cloudinary.com' ||
        url.pathname.split('/')[1] !== this.cloudName
      )
        throw new Error();
      const uploadPath = url.pathname.slice(
        url.pathname.indexOf('/image/upload/') + '/image/upload/'.length,
      );
      if (!/^v\d+\//.test(uploadPath)) throw new Error();
      const actualPublicId = cloudinaryPublicIdFromUrl(secureUrl, this.cloudName);
      if (actualPublicId !== publicId) throw new Error();
      this.validPublicId(publicId, id, assetField);
    } catch {
      throw new BadRequestException('Asset URL is not a canonical Cloudinary upload URL');
    }
  }

  private validPublicId(publicId: string, id: string, assetField: AssetField) {
    if (!new RegExp(`^submissions/${id}/${assetField}/[0-9a-f-]{36}$`).test(publicId))
      throw new BadRequestException('Asset public ID is outside this draft folder');
  }

  private async destroy(publicId: string) {
    this.configured();
    const timestamp = String(Math.floor(Date.now() / 1000));
    const params = { public_id: publicId, timestamp };
    const body = new FormData();
    body.set('api_key', this.apiKey);
    body.set('public_id', publicId);
    body.set('timestamp', timestamp);
    body.set('signature', signCloudinaryParams(params, this.apiSecret));
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${this.cloudName}/image/destroy`,
      { method: 'POST', body },
    );
    if (!response.ok) throw new InternalServerErrorException('Cloudinary asset cleanup failed');
  }
}
