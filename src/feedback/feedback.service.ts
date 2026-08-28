import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFeedbackDto } from './dto/create-feedback.dto';

@Injectable()
export class FeedbackService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateFeedbackDto, userAgent?: string) {
    const feedback = await this.prisma.feedback.create({
      data: {
        type: dto.type,
        message: dto.message,
        contactEmail: dto.contactEmail || null,
        pageUrl: dto.pageUrl || null,
        cafeId: dto.cafeId || null,
        userAgent: userAgent || null,
      },
    });
    return { ...feedback, status: 'new' };
  }
}
