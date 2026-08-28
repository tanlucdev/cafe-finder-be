import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AdminFeedbackService } from './admin-feedback.service';
import { UpdateFeedbackDto } from './dto/update-feedback.dto';

@ApiTags('Admin Feedback')
@Controller('admin/feedback')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@ApiBearerAuth()
export class AdminFeedbackController {
  constructor(private readonly adminFeedbackService: AdminFeedbackService) {}

  @Get()
  @ApiOperation({ summary: 'List feedback' })
  @ApiQuery({ name: 'status', required: false, enum: ['new', 'reviewed', 'archived'] })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  listFeedback(
    @Query('status') status?: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Query('search') search?: string,
  ) {
    return this.adminFeedbackService.listFeedback(status, +page, +limit, search);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get feedback detail' })
  getFeedback(@Param('id') id: string) {
    return this.adminFeedbackService.getFeedback(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update feedback status or admin note' })
  updateFeedback(@Param('id') id: string, @Body() dto: UpdateFeedbackDto) {
    return this.adminFeedbackService.updateFeedback(id, dto);
  }
}
