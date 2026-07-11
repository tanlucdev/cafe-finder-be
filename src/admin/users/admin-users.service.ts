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

  async listUsers(page: number = 1, limit: number = 20) {
    const where = { isHidden: false };
    const [data, total] = await Promise.all([
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
          isHidden: true,
          createdAt: true,
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async hideUser(id: string, actorId: string) {
    if (id === actorId) throw new BadRequestException('Cannot hide yourself');

    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true },
    });
    if (!user) throw new NotFoundException('User not found');

    if (user.role === 'ADMIN') {
      const admins = await this.prisma.user.count({ where: { role: 'ADMIN', isHidden: false } });
      if (admins <= 1) throw new ForbiddenException('Cannot hide the last admin');
    }

    return this.prisma.user.update({
      where: { id },
      data: { isHidden: true },
      select: {
        id: true,
        email: true,
        displayName: true,
        role: true,
        isHidden: true,
        createdAt: true,
      },
    });
  }
}
