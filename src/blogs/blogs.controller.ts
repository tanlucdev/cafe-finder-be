import { Controller, Get, Header, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { BlogsService } from './blogs.service';
import { BlogQueryDto, RelatedBlogQueryDto } from './dto/blog-query.dto';

@ApiTags('Blogs')
@Controller(['blog', 'blogs'])
export class BlogsController {
  constructor(private readonly blogsService: BlogsService) {}

  @Get()
  @Header('Cache-Control', 'public, max-age=60, stale-while-revalidate=300')
  @ApiOperation({ summary: 'List published blog posts' })
  listPosts(@Query() query: BlogQueryDto) {
    return this.blogsService.listPosts(query);
  }

  @Get(':slug/related')
  @Header('Cache-Control', 'public, max-age=120, stale-while-revalidate=600')
  @ApiOperation({ summary: 'List related published blog posts' })
  getRelatedPosts(@Param('slug') slug: string, @Query() query: RelatedBlogQueryDto) {
    return this.blogsService.getRelatedPosts(slug, query.locale, query.limit);
  }

  @Get(':slug')
  @Header('Cache-Control', 'public, max-age=300, stale-while-revalidate=600')
  @ApiOperation({ summary: 'Get published blog post by slug' })
  getPostBySlug(@Param('slug') slug: string, @Query('locale') locale?: string) {
    return this.blogsService.getPostBySlug(slug, locale);
  }
}
