import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { CreateCafeDto } from './dto/create-cafe.dto';
import { UpdateCafeDto } from './dto/update-cafe.dto';
import { ReviewSubmissionDto } from './dto/review-submission.dto';
import slugify from 'slugify';

@Injectable()
export class AdminService {
  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
  ) {}

  // ── Cafes ──

  async getAllCafes(page: number = 1, limit: number = 20) {
    const [data, total] = await Promise.all([
      this.prisma.cafe.findMany({
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.cafe.count(),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async createCafe(dto: CreateCafeDto) {
    const slug = dto.slug || slugify(dto.name, { lower: true, locale: 'vi', strict: true });

    return this.prisma.cafe.create({
      data: {
        ...dto,
        slug,
        priceRange: dto.priceRange as any,
      },
    });
  }

  async updateCafe(id: string, dto: UpdateCafeDto) {
    await this.findCafeOrThrow(id);

    const data: any = { ...dto };
    if (dto.name && !dto.slug) {
      data.slug = slugify(dto.name, { lower: true, locale: 'vi', strict: true });
    }
    if (dto.priceRange) {
      data.priceRange = dto.priceRange as any;
    }

    return this.prisma.cafe.update({ where: { id }, data });
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

  async uploadCafeImage(id: string, file: Express.Multer.File) {
    const cafe = await this.findCafeOrThrow(id);
    const url = await this.storage.uploadImage(file, `cafes/${id}`);

    const updated = await this.prisma.cafe.update({
      where: { id },
      data: {
        images: [...cafe.images, url],
        coverImage: cafe.coverImage ?? url,
      },
    });

    return { url, images: updated.images, coverImage: updated.coverImage };
  }

  private async findCafeOrThrow(id: string) {
    const cafe = await this.prisma.cafe.findUnique({ where: { id } });
    if (!cafe) throw new NotFoundException(`Không tìm thấy quán: ${id}`);
    return cafe;
  }

  // ── Submissions ──

  async getSubmissions(status?: string) {
    return this.prisma.cafeSubmission.findMany({
      where: status ? { status: status as any } : undefined,
      include: {
        submittedBy: {
          select: { id: true, email: true, displayName: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async reviewSubmission(id: string, dto: ReviewSubmissionDto) {
    const submission = await this.prisma.cafeSubmission.findUnique({ where: { id } });
    if (!submission) throw new NotFoundException(`Không tìm thấy submission: ${id}`);

    return this.prisma.cafeSubmission.update({
      where: { id },
      data: { status: dto.status as any },
    });
  }
}
