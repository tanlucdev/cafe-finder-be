import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AdminBlogsService } from './admin-blogs.service';
import { AdminBlogFilterDto } from './dto/admin-blog-filter.dto';
import { CreateBlogPostDto } from './dto/create-blog-post.dto';
import { ToggleBlogFeatureDto } from './dto/toggle-blog-feature.dto';
import { UpdateBlogPostDto } from './dto/update-blog-post.dto';

@ApiTags('Admin Blogs')
@Controller('admin/blogs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@ApiBearerAuth()
export class AdminBlogsController {
  constructor(private readonly adminBlogsService: AdminBlogsService) {}

  @Get()
  @ApiOperation({ summary: 'List blog posts with admin filters' })
  listPosts(@Query() filter: AdminBlogFilterDto) {
    return this.adminBlogsService.listPosts(filter);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get single blog post' })
  getPost(@Param('id') id: string) {
    return this.adminBlogsService.getPost(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a blog post' })
  createPost(@Body() dto: CreateBlogPostDto) {
    return this.adminBlogsService.createPost(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a blog post' })
  updatePost(@Param('id') id: string, @Body() dto: UpdateBlogPostDto) {
    return this.adminBlogsService.updatePost(id, dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a blog post (legacy alias)' })
  replacePost(@Param('id') id: string, @Body() dto: UpdateBlogPostDto) {
    return this.adminBlogsService.updatePost(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a blog post' })
  deletePost(@Param('id') id: string) {
    return this.adminBlogsService.deletePost(id);
  }

  @Patch(':id/publish')
  @ApiOperation({ summary: 'Toggle blog publish state' })
  togglePublish(@Param('id') id: string) {
    return this.adminBlogsService.togglePublish(id);
  }

  @Patch(':id/feature')
  @ApiOperation({ summary: 'Toggle blog featured state and order' })
  toggleFeature(@Param('id') id: string, @Body() dto: ToggleBlogFeatureDto) {
    return this.adminBlogsService.toggleFeature(id, dto.featuredOrder);
  }
}
