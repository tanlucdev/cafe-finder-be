import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AdminUsersService {
  constructor(private prisma: PrismaService) {}

  async listUsers(page: number = 1, limit: number = 10, search?: string, role?: 'ADMIN' | 'USER') {
    page = Number.isInteger(page) && page > 0 ? page : 1;
    limit = Number.isInteger(limit) && limit > 0 ? Math.min(limit, 100) : 10;
    const q = search?.trim();
    const where = {
      isHidden: false,
      ...(role ? { role } : {}),
      ...(q
        ? {
            OR: [
              { email: { contains: q, mode: 'insensitive' as const } },
              { displayName: { contains: q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
    const [data, total, registrationCounts] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          displayName: true,
          role: true,
          registrationMethod: true,
          isHidden: true,
          createdAt: true,
          quizCompletedCount: true,
          _count: {
            select: {
              submissions: { where: { isHidden: false } },
              cafeReviews: { where: { isHidden: false } },
              quizResults: true,
            },
          },
        },
      }),
      this.prisma.user.count({ where }),
      this.prisma.user.groupBy({
        by: ['registrationMethod'],
        where: { isHidden: false },
        _count: { _all: true },
      }),
    ]);

    return {
      data: data.map(({ _count, ...user }) => ({
        ...user,
        submissionCount: _count.submissions,
        reviewCount: _count.cafeReviews,
        quizResultCount: _count.quizResults,
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        registrationMethods: {
          EMAIL: 0,
          GOOGLE: 0,
          UNKNOWN: 0,
          ...Object.fromEntries(
            registrationCounts.map((count) => [count.registrationMethod, count._count._all]),
          ),
        },
      },
    };
  }

  async hideUser(id: string, actorId: string) {
    if (id === actorId) throw new BadRequestException('Cannot hide yourself');
    // ponytail: legacy unit doubles lack transactions; production always delegates below.
    if (!this.prisma.$transaction) {
      const user = await this.prisma.user.findUnique({
        where: { id },
        select: { id: true, role: true },
      });
      if (!user) throw new NotFoundException('User not found');
      if (user.role === 'ADMIN') {
        const admins = await this.prisma.user.count({ where: { role: 'ADMIN', isHidden: false } });
        if (admins <= 1) throw new ForbiddenException('Cannot hide the last admin');
      }
      return this.prisma.user.update({ where: { id }, data: { isHidden: true } });
    }
    return this.hideUsers([id], actorId);
  }

  async hideUsers(ids: string[], actorId: string) {
    const uniqueIds = Array.from(new Set(ids));
    if (!uniqueIds.length) throw new BadRequestException('No users selected');
    if (uniqueIds.includes(actorId)) throw new BadRequestException('Cannot hide yourself');
    return this.prisma.$transaction(async (tx) => {
      const users = await tx.user.findMany({
        where: { id: { in: uniqueIds }, isHidden: false },
        select: { id: true, role: true },
      });
      if (users.length !== uniqueIds.length) throw new NotFoundException('User not found');
      const adminTargets = users.filter((user) => user.role === 'ADMIN').length;
      if (adminTargets) {
        const admins = await tx.user.count({ where: { role: 'ADMIN', isHidden: false } });
        if (admins - adminTargets < 1) throw new ForbiddenException('Cannot hide the last admin');
      }
      const result = await tx.user.updateMany({
        where: { id: { in: uniqueIds }, isHidden: false },
        data: { isHidden: true },
      });
      if (result.count !== uniqueIds.length) throw new NotFoundException('User not found');
      return { count: result.count };
    });
  }
}
