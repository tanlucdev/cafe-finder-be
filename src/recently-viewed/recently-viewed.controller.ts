import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RecentlyViewedQueryDto } from './dto/recently-viewed-query.dto';
import { RecentlyViewedService } from './recently-viewed.service';

@ApiTags('Recently Viewed')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('recently-viewed')
export class RecentlyViewedController {
  constructor(private readonly recentlyViewedService: RecentlyViewedService) {}

  @Get()
  @ApiOperation({ summary: 'Get recently viewed cafes for the current user' })
  @ApiQuery({ name: 'locale', required: false, enum: ['vi', 'en'] })
  @ApiQuery({
    name: 'limit',
    required: false,
    schema: { type: 'integer', minimum: 1, maximum: 20, default: 20 },
  })
  @ApiOkResponse({
    description: 'Newest-first recently viewed cafes',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          cafe: { type: 'object' },
          viewedAt: { type: 'string', format: 'date-time' },
        },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  getRecentlyViewed(
    @CurrentUser() user: { id: string },
    @Query() query: RecentlyViewedQueryDto,
  ) {
    return this.recentlyViewedService.getRecentlyViewed(user.id, query.locale, query.limit ?? 20);
  }
}
