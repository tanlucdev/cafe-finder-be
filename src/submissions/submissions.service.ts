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
}
