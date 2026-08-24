import { Injectable, NotFoundException } from '@nestjs/common';
import slugify from 'slugify';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AdminSubmissionsService {
  constructor(private prisma: PrismaService) {}

  async listSubmissions(status?: string, page: number = 1, limit: number = 10, search?: string) {
    page = Number.isInteger(page) && page > 0 ? page : 1;
    limit = Number.isInteger(limit) && limit > 0 ? Math.min(limit, 100) : 10;
    const q = search?.trim();
    const where = {
      isHidden: false,
      ...(status ? { status: status as any } : {}),
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
      },
    });
    if (!submission || submission.isHidden) throw new NotFoundException(`Submission not found: ${id}`);
    return submission;
  }

  async approveSubmission(id: string, note?: string) {
    const submission = await this.prisma.cafeSubmission.findUnique({ where: { id } });
    if (!submission) throw new NotFoundException(`Submission not found: ${id}`);

    const slug = slugify(submission.name, { lower: true, locale: 'vi', strict: true });
    const reviewNote = note?.trim();

    const [updatedSubmission, cafe] = await Promise.all([
      this.prisma.cafeSubmission.update({
        where: { id },
        data: {
          status: 'approved',
          ...(note !== undefined ? { reviewNote: reviewNote || null } : {}),
        },
      }),
      this.prisma.cafe.create({
        data: {
          name: submission.name,
          slug,
          address: submission.address ?? undefined,
          googleMapsUrl: submission.googleMapsUrl ?? undefined,
          isPublished: false,
        },
      }),
    ]);

    return { submission: updatedSubmission, cafe };
  }

  async rejectSubmission(id: string, note?: string) {
    const submission = await this.prisma.cafeSubmission.findUnique({ where: { id } });
    if (!submission) throw new NotFoundException(`Submission not found: ${id}`);
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
    if (!submission || submission.isHidden) throw new NotFoundException(`Submission not found: ${id}`);

    return this.prisma.cafeSubmission.update({
      where: { id },
      data: { isHidden: true },
    });
  }
}
