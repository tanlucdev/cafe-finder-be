import { Injectable, NotFoundException } from '@nestjs/common';
import slugify from 'slugify';
import { PrismaService } from '../../prisma/prisma.service';
import { AdminBlogFilterDto } from './dto/admin-blog-filter.dto';
import { CreateBlogPostDto } from './dto/create-blog-post.dto';
import { UpdateBlogPostDto } from './dto/update-blog-post.dto';

type BlogPostPayload = CreateBlogPostDto | UpdateBlogPostDto;

function makeSlug(value: string) {
  return slugify(value, { lower: true, locale: 'vi', strict: true });
}

function cleanList(items?: string[]) {
  return items?.map((item) => item.trim()).filter(Boolean);
}

function buildBlogPostData(dto: BlogPostPayload, isCreate = false) {
  const data: Record<string, unknown> = {};
  const assign = <K extends keyof BlogPostPayload>(key: K) => {
    if (dto[key] !== undefined) data[key as string] = dto[key];
  };

  assign('heroImage');
  assign('accent');
  assign('titleVi');
  assign('titleEn');
  assign('excerptVi');
  assign('excerptEn');
  assign('categoryVi');
  assign('categoryEn');
  assign('readTimeVi');
  assign('readTimeEn');
  assign('author');
  assign('moodVi');
  assign('moodEn');
  assign('locationVi');
  assign('locationEn');
  assign('heroImageAltVi');
  assign('heroImageAltEn');
  assign('introVi');
  assign('introEn');
  assign('pullQuoteVi');
  assign('pullQuoteEn');
  assign('featuredOrder');

  if (dto.slug !== undefined) data.slug = makeSlug(dto.slug);
  if (isCreate && !dto.slug && 'titleVi' in dto && dto.titleVi) data.slug = makeSlug(dto.titleVi);
  if (dto.tags !== undefined) data.tags = cleanList(dto.tags) ?? [];
  if (dto.sectionsVi !== undefined) data.sectionsVi = dto.sectionsVi;
  if (dto.sectionsEn !== undefined) data.sectionsEn = dto.sectionsEn;
  if (dto.checklistVi !== undefined) data.checklistVi = cleanList(dto.checklistVi) ?? [];
  if (dto.checklistEn !== undefined) data.checklistEn = cleanList(dto.checklistEn) ?? [];
  if (dto.isFeatured !== undefined) {
    data.isFeatured = dto.isFeatured;
    if (!dto.isFeatured) data.featuredOrder = null;
  }
  if (dto.isPublished !== undefined) data.isPublished = dto.isPublished;
  if (dto.publishedAt !== undefined) {
    data.publishedAt = dto.publishedAt ? new Date(dto.publishedAt) : null;
  }

  if (dto.isPublished === true && !dto.publishedAt) {
    data.publishedAt = new Date();
  }

  return data;
}

@Injectable()
export class AdminBlogsService {
  constructor(private prisma: PrismaService) {}

  async listPosts(filter: AdminBlogFilterDto) {
    const { search, tag, is_published, is_featured, page = 1, limit = 20 } = filter;
    const where: any = {
      ...(tag && { tags: { has: tag } }),
      ...(is_published !== undefined && { isPublished: is_published }),
      ...(is_featured !== undefined && { isFeatured: is_featured }),
      ...(search && {
        OR: [
          { titleVi: { contains: search, mode: 'insensitive' } },
          { titleEn: { contains: search, mode: 'insensitive' } },
          { excerptVi: { contains: search, mode: 'insensitive' } },
          { excerptEn: { contains: search, mode: 'insensitive' } },
          { slug: { contains: search, mode: 'insensitive' } },
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
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async getPost(id: string) {
    return this.findPostOrThrow(id);
  }

  async createPost(dto: CreateBlogPostDto) {
    return this.prisma.blogPost.create({
      data: {
        accent: 'amber',
        author: 'Cafe Maps Editorial',
        tags: [],
        sectionsVi: [],
        sectionsEn: [],
        checklistVi: [],
        checklistEn: [],
        isFeatured: false,
        isPublished: false,
        ...buildBlogPostData(dto, true),
      } as any,
    });
  }

  async updatePost(id: string, dto: UpdateBlogPostDto) {
    await this.findPostOrThrow(id);

    const data = buildBlogPostData(dto);
    if (dto.isPublished === true && dto.publishedAt === undefined) {
      const existing = await this.findPostOrThrow(id);
      if (existing.publishedAt) delete data.publishedAt;
    }

    return this.prisma.blogPost.update({ where: { id }, data: data as any });
  }

  async deletePost(id: string) {
    await this.findPostOrThrow(id);
    return this.prisma.blogPost.delete({ where: { id } });
  }

  async togglePublish(id: string) {
    const post = await this.findPostOrThrow(id);
    const isPublished = !post.isPublished;

    return this.prisma.blogPost.update({
      where: { id },
      data: {
        isPublished,
        ...(isPublished && !post.publishedAt ? { publishedAt: new Date() } : {}),
      },
    });
  }

  async toggleFeature(id: string, featuredOrder?: number | null) {
    const post = await this.findPostOrThrow(id);
    const isFeatured = !post.isFeatured;

    return this.prisma.blogPost.update({
      where: { id },
      data: {
        isFeatured,
        ...(isFeatured && featuredOrder != null ? { featuredOrder } : {}),
        ...(!isFeatured ? { featuredOrder: null } : {}),
      },
    });
  }

  private async findPostOrThrow(id: string) {
    const post = await this.prisma.blogPost.findUnique({ where: { id } });
    if (!post) throw new NotFoundException(`Blog post not found: ${id}`);
    return post;
  }
}
