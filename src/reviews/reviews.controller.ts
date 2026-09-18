import { Body, Controller, Delete, Get, Param, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UpsertReviewDto } from './dto/upsert-review.dto';
import { ReviewsService } from './reviews.service';

@ApiTags('Reviews')
@Controller('cafes/:cafeId/reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get()
  @ApiOperation({ summary: 'List visible cafe reviews with summary' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  list(
    @Param('cafeId') cafeId: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    return this.reviewsService.list(cafeId, +page, +limit);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user review for a cafe' })
  getMine(@CurrentUser() user: { id: string }, @Param('cafeId') cafeId: string) {
    return this.reviewsService.getMine(user.id, cafeId);
  }

  @Put()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create or update current user review for a cafe' })
  upsert(
    @CurrentUser() user: { id: string },
    @Param('cafeId') cafeId: string,
    @Body() dto: UpsertReviewDto,
  ) {
    return this.reviewsService.upsert(user.id, cafeId, dto);
  }

  @Delete('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete current user review for a cafe' })
  deleteMine(@CurrentUser() user: { id: string }, @Param('cafeId') cafeId: string) {
    return this.reviewsService.deleteMine(user.id, cafeId);
  }
}
