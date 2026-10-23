import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AdminVotesService } from './admin-votes.service';

@ApiTags('Admin Votes')
@Controller('admin/votes')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@ApiBearerAuth()
export class AdminVotesController {
  constructor(private readonly adminVotesService: AdminVotesService) {}

  @Get()
  @ApiOperation({ summary: 'List vote history' })
  @ApiQuery({ name: 'action', required: false, enum: ['VOTE', 'UNVOTE'] })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'date', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  list(
    @Query('action') action?: string,
    @Query('search') search?: string,
    @Query('date') date?: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
  ) {
    return this.adminVotesService.list(action, search, date, +page, +limit);
  }
}
