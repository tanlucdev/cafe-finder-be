import { Controller, Get, Header, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { CafesService } from './cafes.service';
import { CafeFilterDto } from './dto/cafe-filter.dto';

@ApiTags('Cafes')
@Controller('cafes')
export class CafesController {
  constructor(private readonly cafesService: CafesService) {}

  @Get()
  @Header('Cache-Control', 'public, max-age=60, stale-while-revalidate=300')
  @ApiOperation({ summary: 'List cafes with filters and pagination' })
  findAll(@Query() filter: CafeFilterDto) {
    return this.cafesService.findAll(filter);
  }

  // Specific routes must be placed BEFORE /:slug
  @Get('nearby')
  @Header('Cache-Control', 'public, max-age=30')
  @ApiOperation({ summary: 'Find cafes near a location (PostGIS, optional OSRM route distance)' })
  @ApiQuery({ name: 'lat', required: true, type: Number })
  @ApiQuery({ name: 'lng', required: true, type: Number })
  @ApiQuery({
    name: 'radius',
    required: false,
    type: Number,
    description: 'Radius in km, default 2',
  })
  @ApiQuery({
    name: 'distanceMode',
    required: false,
    enum: ['straight', 'route'],
    description: 'straight = PostGIS direct distance, route = OSRM driving distance with fallback',
  })
  findNearby(
    @Query('lat') lat: number,
    @Query('lng') lng: number,
    @Query('radius') radius: number = 2,
    @Query('distanceMode') distanceMode: 'straight' | 'route' = 'straight',
    @Query('locale') locale?: string,
  ) {
    return this.cafesService.findNearby(
      +lat,
      +lng,
      +radius,
      distanceMode === 'route' ? 'route' : 'straight',
      locale,
    );
  }

  @Get('districts')
  @Header('Cache-Control', 'public, max-age=3600, stale-while-revalidate=7200')
  @ApiOperation({ summary: 'List districts that have cafes' })
  getDistricts(@Query('locale') locale?: string) {
    return this.cafesService.getDistricts(locale);
  }

  @Get('quiz-match')
  @Header('Cache-Control', 'public, max-age=60, stale-while-revalidate=300')
  @ApiOperation({ summary: 'Recommend cafes by vibe and purpose' })
  @ApiQuery({ name: 'vibes', required: false, example: 'Cozy,Artistic' })
  @ApiQuery({ name: 'purposes', required: false, example: 'Work,Study' })
  @ApiQuery({ name: 'tags', required: false, example: 'outdoor,smoking' })
  quizMatch(
    @Query('vibes') vibes: string,
    @Query('purposes') purposes: string,
    @Query('tags') tags: string,
    @Query('locale') locale?: string,
  ) {
    const vibeArr = vibes ? vibes.split(',').filter(Boolean) : [];
    const purposeArr = purposes ? purposes.split(',').filter(Boolean) : [];
    const tagArr = tags ? tags.split(',').filter(Boolean) : [];
    return this.cafesService.quizMatch(vibeArr, purposeArr, locale, tagArr);
  }

  @Get(':slug')
  @Header('Cache-Control', 'public, max-age=300, stale-while-revalidate=600')
  @ApiOperation({ summary: 'Get cafe details by slug' })
  findOne(@Param('slug') slug: string, @Query('locale') locale?: string) {
    return this.cafesService.findBySlug(slug, locale);
  }
}
