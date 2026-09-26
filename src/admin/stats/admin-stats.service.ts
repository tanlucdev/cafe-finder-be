import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

const vietnamDate = () => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts();
  const part = (type: string) => parts.find((item) => item.type === type)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
};

const vietnamDayBounds = (date = vietnamDate()) => {
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
  return { date, start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
};

@Injectable()
export class AdminStatsService {
  constructor(private prisma: PrismaService) {}

  async getStats(date?: string) {
    const day = vietnamDayBounds(date);
    const createdToday = { createdAt: { gte: day.start, lt: day.end } };
    const [
      total_cafes,
      published_cafes,
      featured_cafes,
      pending_submissions,
      total_users,
      draft_cafes,
      published_blogs,
      draft_blogs,
      new_cafes,
      new_blogs,
      new_users,
      new_submissions,
      new_feedback,
      new_reviews,
      visible_reviews,
      hidden_reviews,
      feedback_queue,
    ] = await Promise.all([
      this.prisma.cafe.count({ where: { isHidden: false } }),
      this.prisma.cafe.count({ where: { isPublished: true, isHidden: false } }),
      this.prisma.cafe.count({ where: { isFeatured: true, isHidden: false } }),
      this.prisma.cafeSubmission.count({ where: { status: 'pending', isHidden: false } }),
      this.prisma.user.count({ where: { isHidden: false } }),
      this.prisma.cafe.count({ where: { isPublished: false, isHidden: false } }),
      this.prisma.blogPost.count({ where: { isPublished: true, isHidden: false } }),
      this.prisma.blogPost.count({ where: { isPublished: false, isHidden: false } }),
      this.prisma.cafe.count({ where: { ...createdToday, isHidden: false } }),
      this.prisma.blogPost.count({ where: { ...createdToday, isHidden: false } }),
      this.prisma.user.count({ where: { ...createdToday, isHidden: false } }),
      this.prisma.cafeSubmission.count({ where: { ...createdToday, isHidden: false } }),
      this.prisma.feedback.count({ where: { ...createdToday, isHidden: false } }),
      this.prisma.cafeReview.count({ where: { ...createdToday, isHidden: false } }),
      this.prisma.cafeReview.count({ where: { isHidden: false } }),
      this.prisma.cafeReview.count({ where: { isHidden: true } }),
      this.prisma.feedback.count({ where: { status: 'NEW', isHidden: false } }),
    ]);

    return {
      total_cafes,
      published_cafes,
      featured_cafes,
      pending_submissions,
      total_users,
      draft_cafes,
      published_blogs,
      draft_blogs,
      today: {
        date: day.date,
        new_cafes,
        new_blogs,
        new_users,
        new_submissions,
        new_feedback,
        new_reviews,
      },
      queues: {
        pending_submissions,
        new_feedback: feedback_queue,
        visible_reviews,
        hidden_reviews,
      },
    };
  }
}
