import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type QuizResultInput = {
  profileId?: unknown;
  profileTitle?: unknown;
  variant?: unknown;
  score?: unknown;
  dna?: unknown;
  chips?: unknown;
  answers?: unknown;
};

@Injectable()
export class QuizService {
  constructor(private prisma: PrismaService) {}

  async recordCompletion(userId: string, result?: QuizResultInput) {
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id: userId },
        data: { quizCompletedCount: { increment: 1 } },
        select: { quizCompletedCount: true },
      });

      if (result) {
        const data = normalizeQuizResult(result);
        await tx.quizResult.create({ data: { user: { connect: { id: userId } }, ...data } });
      }

      return user;
    });
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        quizCompletedCount: true,
        quizResults: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            id: true,
            profileId: true,
            profileTitle: true,
            variant: true,
            score: true,
            dna: true,
            chips: true,
            answers: true,
            createdAt: true,
          },
        },
      },
    });
    if (!user) throw new NotFoundException('User not found');

    return { quizCompletedCount: user.quizCompletedCount, results: user.quizResults };
  }
}

function normalizeQuizResult(input: QuizResultInput) {
  if (typeof input.profileId !== 'string' || typeof input.profileTitle !== 'string') {
    throw new BadRequestException('Invalid quiz result payload');
  }
  const score =
    typeof input.score === 'number' && Number.isFinite(input.score)
      ? Math.round(input.score)
      : undefined;
  return {
    profileId: input.profileId,
    profileTitle: input.profileTitle,
    variant: typeof input.variant === 'string' ? input.variant : undefined,
    score,
    dna: typeof input.dna === 'string' ? input.dna : undefined,
    chips: input.chips === undefined ? undefined : json(input.chips),
    answers: input.answers === undefined ? undefined : json(input.answers),
  };
}

function json(value: unknown): Prisma.InputJsonValue {
  try {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  } catch {
    throw new BadRequestException('Invalid quiz result JSON');
  }
}
