import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

const vietnamDayBounds = (date: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) throw new BadRequestException('date must use YYYY-MM-DD');
  const [year, month, day] = match.slice(1).map(Number);
  const utcDay = new Date(Date.UTC(year, month - 1, day));
  if (
    utcDay.getUTCFullYear() !== year ||
    utcDay.getUTCMonth() !== month - 1 ||
    utcDay.getUTCDate() !== day
  ) {
    throw new BadRequestException('date must be a valid calendar date');
  }
  const start = new Date(utcDay.getTime() - 7 * 60 * 60 * 1000);
  return { start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
};

const maskEmail = (email?: string | null) => {
  const [name, domain] = email?.split('@') ?? [];
  return domain ? `${name.slice(0, 1) || 'u'}***@${domain}` : 'Cafe Maps user';
};

@Injectable()
export class AdminVotesService {
  constructor(private prisma: PrismaService) {}

  async list(
    action?: string,
    search?: string,
    date?: string,
    page: number = 1,
    limit: number = 20,
  ) {
    if (action && action !== 'VOTE' && action !== 'UNVOTE')
      throw new BadRequestException('action must be VOTE or UNVOTE');
    page = Number.isInteger(page) && page > 0 ? page : 1;
    limit = Number.isInteger(limit) && limit > 0 ? Math.min(limit, 100) : 20;
    const q = search?.trim();
    const day = date ? vietnamDayBounds(date) : undefined;
    const where = {
      ...(action ? { action: action as 'VOTE' | 'UNVOTE' } : {}),
      ...(day ? { createdAt: { gte: day.start, lt: day.end } } : {}),
      ...(q ? { cafe: { name: { contains: q, mode: 'insensitive' as const } } } : {}),
    };
    const include = {
      cafe: { select: { id: true, name: true, slug: true } },
      user: { select: { displayName: true, email: true } },
    };
    const [data, total] = await Promise.all([
      this.prisma.cafeVoteEvent.findMany({
        where,
        include,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.cafeVoteEvent.count({ where }),
    ]);
    return {
      data: data.map((event) => ({
        id: event.id,
        action: event.action,
        cafeId: event.cafeId,
        userId: event.userId,
        createdAt: event.createdAt,
        cafe: event.cafe,
        author_name:
          event.user.displayName?.trim() && !event.user.displayName.includes('@')
            ? event.user.displayName.trim()
            : maskEmail(event.user.email),
      })),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }
}
