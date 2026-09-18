import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AdminReviewsService } from './admin-reviews.service';
import { UpdateReviewDto } from './dto/update-review.dto';

@ApiTags('Admin Reviews')
@Controller('admin/reviews')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@ApiBearerAuth()
export class AdminReviewsController {
  constructor(private readonly adminReviewsService: AdminReviewsService) {}

  @Get()
  @ApiOperation({ summary: 'List cafe reviews for moderation' })
  @ApiQuery({ name: 'hidden', required: false, enum: ['true', 'false'] })
  @ApiQuery({ name: 'cafeId', required: false, type: String })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  list(
    @Query('hidden') hidden?: string,
    @Query('cafeId') cafeId?: string,
    @Query('search') search?: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    return this.adminReviewsService.list(hidden, cafeId, search, +page, +limit);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Hide/unhide a review and update admin note' })
  update(@Param('id') id: string, @Body() dto: UpdateReviewDto) {
    return this.adminReviewsService.update(id, dto);
  }
}
