import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSubmissionDto } from './dto/create-submission.dto';

@Injectable()
export class SubmissionsService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateSubmissionDto) {
    return this.prisma.cafeSubmission.create({
      data: {
        submittedById: userId,
        name: dto.name,
        address: dto.address,
        googleMapsUrl: dto.googleMapsUrl,
        note: dto.note,
      },
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
