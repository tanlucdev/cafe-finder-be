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
  @ApiOperation({ summary: 'Danh sách quán với filter và pagination' })
  findAll(@Query() filter: CafeFilterDto) {
    return this.cafesService.findAll(filter);
  }

  // Các route cụ thể phải đặt TRƯỚC /:slug
  @Get('nearby')
  @Header('Cache-Control', 'public, max-age=30')
  @ApiOperation({ summary: 'Tìm quán gần vị trí hiện tại (PostGIS)' })
  @ApiQuery({ name: 'lat', required: true, type: Number })
  @ApiQuery({ name: 'lng', required: true, type: Number })
  @ApiQuery({ name: 'radius', required: false, type: Number, description: 'Bán kính km, mặc định 2' })
  findNearby(
    @Query('lat') lat: number,
    @Query('lng') lng: number,
    @Query('radius') radius: number = 2,
  ) {
    return this.cafesService.findNearby(+lat, +lng, +radius);
  }

  @Get('districts')
  @Header('Cache-Control', 'public, max-age=3600, stale-while-revalidate=7200')
  @ApiOperation({ summary: 'Danh sách quận có quán' })
  getDistricts() {
    return this.cafesService.getDistricts();
  }

  @Get('quiz-match')
  @Header('Cache-Control', 'public, max-age=60, stale-while-revalidate=300')
  @ApiOperation({ summary: 'Gợi ý quán theo vibe và mục đích' })
  @ApiQuery({ name: 'vibes', required: false, example: 'Cozy,Artistic' })
  @ApiQuery({ name: 'purposes', required: false, example: 'Work,Study' })
  quizMatch(
    @Query('vibes') vibes: string,
    @Query('purposes') purposes: string,
  ) {
    const vibeArr = vibes ? vibes.split(',').filter(Boolean) : [];
    const purposeArr = purposes ? purposes.split(',').filter(Boolean) : [];
    return this.cafesService.quizMatch(vibeArr, purposeArr);
  }

  @Get(':slug')
  @Header('Cache-Control', 'public, max-age=300, stale-while-revalidate=600')
  @ApiOperation({ summary: 'Chi tiết quán theo slug' })
  findOne(@Param('slug') slug: string) {
    return this.cafesService.findBySlug(slug);
  }
}
