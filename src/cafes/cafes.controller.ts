import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { CafesService } from './cafes.service';
import { CafeFilterDto } from './dto/cafe-filter.dto';

@ApiTags('Cafes')
@Controller('cafes')
export class CafesController {
  constructor(private readonly cafesService: CafesService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách quán với filter và pagination' })
  findAll(@Query() filter: CafeFilterDto) {
    return this.cafesService.findAll(filter);
  }

  // Các route cụ thể phải đặt TRƯỚC /:slug
  @Get('nearby')
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
  @ApiOperation({ summary: 'Danh sách quận có quán' })
  getDistricts() {
    return this.cafesService.getDistricts();
  }

  @Get('quiz-match')
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
  @ApiOperation({ summary: 'Chi tiết quán theo slug' })
  findOne(@Param('slug') slug: string) {
    return this.cafesService.findBySlug(slug);
  }
}
