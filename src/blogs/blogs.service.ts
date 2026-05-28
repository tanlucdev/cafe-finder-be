import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { serializeLocalizedBlogPost } from './blog-post.mapper';
import { BlogQueryDto } from './dto/blog-query.dto';

@Injectable()
export class BlogsService {
  constructor(private prisma: PrismaService) {}

  async listPosts(query: BlogQueryDto) {
    const { locale, search, tag, page = 1, limit = 12 } = query;
    const where: any = {
      isPublished: true,
      ...(tag && { tags: { has: tag } }),
      ...(search && {
        OR: [
          { titleVi: { contains: search, mode: 'insensitive' } },
          { titleEn: { contains: search, mode: 'insensitive' } },
          { excerptVi: { contains: search, mode: 'insensitive' } },
          { excerptEn: { contains: search, mode: 'insensitive' } },
          { categoryVi: { contains: search, mode: 'insensitive' } },
          { categoryEn: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.blogPost.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [
          { isFeatured: 'desc' },
          { featuredOrder: 'asc' },
          { publishedAt: 'desc' },
          { createdAt: 'desc' },
        ],
      }),
      this.prisma.blogPost.count({ where }),
    ]);

    return {
      data: data.map((post) => serializeLocalizedBlogPost(post, locale)),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async getPostBySlug(slug: string, locale?: string) {
    const post = await this.prisma.blogPost.findUnique({
      where: { slug, isPublished: true },
    });

    if (!post) {
      throw new NotFoundException(`Blog post not found with slug: ${slug}`);
    }

    return serializeLocalizedBlogPost(post, locale);
  }

  async getRelatedPosts(slug: string, locale?: string, limit = 2) {
    const post = await this.prisma.blogPost.findUnique({
      where: { slug, isPublished: true },
      select: { id: true, tags: true },
    });

    if (!post) {
      throw new NotFoundException(`Blog post not found with slug: ${slug}`);
    }

    const related = await this.prisma.blogPost.findMany({
      where: {
        isPublished: true,
        id: { not: post.id },
        ...(post.tags.length ? { tags: { hasSome: post.tags } } : {}),
      },
      take: limit,
      orderBy: [
        { isFeatured: 'desc' },
        { featuredOrder: 'asc' },
        { publishedAt: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    if (related.length >= limit) {
      return related.map((item) => serializeLocalizedBlogPost(item, locale));
    }

    const fallback = await this.prisma.blogPost.findMany({
      where: {
        isPublished: true,
        id: { notIn: [post.id, ...related.map((item) => item.id)] },
      },
      take: limit - related.length,
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
    });

    return [...related, ...fallback].map((item) => serializeLocalizedBlogPost(item, locale));
  }
}
