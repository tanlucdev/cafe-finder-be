import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MarkVisitedDto } from './dto/mark-visited.dto';
import { VisitedService } from './visited.service';

@ApiTags('Visited')
@Controller('visited')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class VisitedController {
  constructor(private readonly visitedService: VisitedService) {}

  @Get()
  @ApiOperation({ summary: 'Get visited cafes' })
  getVisited(@CurrentUser() user: { id: string }, @Query('locale') locale?: string) {
    return this.visitedService.getVisited(user.id, locale);
  }

  @Post()
  @ApiOperation({ summary: 'Mark a cafe as visited' })
  mark(@CurrentUser() user: { id: string }, @Body() dto: MarkVisitedDto) {
    return this.visitedService.mark(user.id, dto.cafeId);
  }

  @Delete(':cafeId')
  @ApiOperation({ summary: 'Unmark a cafe as visited' })
  unmark(@CurrentUser() user: { id: string }, @Param('cafeId') cafeId: string) {
    return this.visitedService.unmark(user.id, cafeId);
  }
}
