import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CafeVotesService {
  constructor(private prisma: PrismaService) {}

  static weekRange(now = new Date()) {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(now);
    const year = Number(parts.find((part) => part.type === 'year')?.value);
    const month = Number(parts.find((part) => part.type === 'month')?.value);
    const day = Number(parts.find((part) => part.type === 'day')?.value);
    const localMidnightUtc = Date.UTC(year, month - 1, day) - 7 * 60 * 60 * 1000;
    const localDow = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
    const daysSinceMonday = (localDow + 6) % 7;
    const currentWeekStart = localMidnightUtc - daysSinceMonday * 86400000;

    return {
      start: new Date(currentWeekStart - 7 * 86400000),
      end: new Date(currentWeekStart),
    };
  }

  async vote(userId: string, cafeId: string) {
    const cafe = await this.prisma.cafe.findFirst({
      where: { id: cafeId, isPublished: true },
      select: { id: true },
    });
    if (!cafe) throw new NotFoundException('Cafe not found');

    try {
      await this.prisma.cafeVote.create({ data: { userId, cafeId } });
    } catch (error: any) {
      if (error?.code !== 'P2002') throw error;
    }

    const { start, end } = CafeVotesService.weekRange();
    const [weeklyVoteCount, voteCount] = await Promise.all([
      this.prisma.cafeVote.count({ where: { cafeId, createdAt: { gte: start, lt: end } } }),
      this.prisma.cafeVote.count({ where: { cafeId } }),
    ]);

    return { cafeId, weeklyVoteCount, voteCount, voted: true };
  }

  async getMyVotes(userId: string) {
    const votes = await this.prisma.cafeVote.findMany({
      where: { userId },
      select: { cafeId: true },
      orderBy: { createdAt: 'desc' },
    });
    return votes.map((vote) => vote.cafeId);
  }
}
