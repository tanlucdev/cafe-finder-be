import { Controller, Get, Header, NotFoundException, Param, ParseIntPipe, Query } from '@nestjs/common';
import { ApiQuery, ApiTags } from '@nestjs/swagger';
import { ChainsService } from './chains.service';

@ApiTags('Chains')
@Controller('chains')
export class ChainsController {
  constructor(private readonly chains: ChainsService) {}

  @Get()
  @Header('Cache-Control', 'public, max-age=300, stale-while-revalidate=600')
  @ApiQuery({ name: 'locale', required: false, enum: ['vi', 'en'] })
  findAll(@Query('locale') locale?: string, @Query('page', new ParseIntPipe({ optional: true })) page = 1, @Query('limit', new ParseIntPipe({ optional: true })) limit = 12) {
    return this.chains.findAll(locale, page, limit);
  }

  @Get(':slug')
  @Header('Cache-Control', 'public, max-age=300, stale-while-revalidate=600')
  findOne(@Param('slug') slug: string, @Query('locale') locale?: string) {
    return this.chains.findOne(slug, locale);
  }
}
