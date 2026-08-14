import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class QuizService {
  constructor(private prisma: PrismaService) {}

  async recordCompletion(userId: string) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { quizCompletedCount: { increment: 1 } },
      select: { quizCompletedCount: true },
    });

    return user;
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { quizCompletedCount: true },
    });
    if (!user) throw new NotFoundException('User not found');

    return user;
  }
}
