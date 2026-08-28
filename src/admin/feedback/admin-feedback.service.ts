import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateFeedbackDto } from './dto/update-feedback.dto';

const statusMap = { new: 'NEW', reviewed: 'REVIEWED', archived: 'ARCHIVED' } as const;
const outStatus = { NEW: 'new', REVIEWED: 'reviewed', ARCHIVED: 'archived' } as const;
const serializeFeedback = (feedback: any) => ({
  ...feedback,
  status: outStatus[feedback.status as keyof typeof outStatus] ?? feedback.status,
});

@Injectable()
export class AdminFeedbackService {
  constructor(private prisma: PrismaService) {}

  async listFeedback(status?: string, page: number = 1, limit: number = 10, search?: string) {
    page = Number.isInteger(page) && page > 0 ? page : 1;
    limit = Number.isInteger(limit) && limit > 0 ? Math.min(limit, 100) : 10;
    const q = search?.trim();
    const where = {
      ...(status && status in statusMap ? { status: statusMap[status as keyof typeof statusMap] } : {}),
      ...(q
        ? {
            OR: [
              { message: { contains: q, mode: 'insensitive' as const } },
              { contactEmail: { contains: q, mode: 'insensitive' as const } },
              { pageUrl: { contains: q, mode: 'insensitive' as const } },
              { cafe: { name: { contains: q, mode: 'insensitive' as const } } },
            ],
          }
        : {}),
    };
    const include = { cafe: { select: { id: true, name: true, slug: true } } };
    const [data, total] = await Promise.all([
      this.prisma.feedback.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        include,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.feedback.count({ where }),
    ]);
    return { data: data.map(serializeFeedback), meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async getFeedback(id: string) {
    const feedback = await this.prisma.feedback.findUnique({
      where: { id },
      include: { cafe: { select: { id: true, name: true, slug: true } } },
    });
    if (!feedback) throw new NotFoundException(`Feedback not found: ${id}`);
    return serializeFeedback(feedback);
  }

  async updateFeedback(id: string, dto: UpdateFeedbackDto) {
    await this.getFeedback(id);
    const feedback = await this.prisma.feedback.update({
      where: { id },
      data: {
        ...(dto.status ? { status: statusMap[dto.status] } : {}),
        ...(dto.adminNote !== undefined ? { adminNote: dto.adminNote || null } : {}),
      },
      include: { cafe: { select: { id: true, name: true, slug: true } } },
    });
    return serializeFeedback(feedback);
  }
}
