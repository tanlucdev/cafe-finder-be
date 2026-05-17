import { Injectable, NotFoundException } from '@nestjs/common';
import slugify from 'slugify';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AdminSubmissionsService {
  constructor(private prisma: PrismaService) {}

  async listSubmissions(status?: string) {
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

  async getSubmission(id: string) {
    const submission = await this.prisma.cafeSubmission.findUnique({
      where: { id },
      include: {
        submittedBy: { select: { id: true, email: true, displayName: true } },
      },
    });
    if (!submission) throw new NotFoundException(`Submission not found: ${id}`);
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
}
