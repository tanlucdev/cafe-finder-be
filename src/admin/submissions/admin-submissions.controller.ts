import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AdminSubmissionsService } from './admin-submissions.service';

@ApiTags('Admin Submissions')
@Controller('admin/submissions')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@ApiBearerAuth()
export class AdminSubmissionsController {
  constructor(private readonly adminSubmissionsService: AdminSubmissionsService) {}

  @Get()
  @ApiOperation({ summary: 'List cafe submissions' })
  @ApiQuery({ name: 'status', required: false, enum: ['pending', 'approved', 'rejected'] })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  listSubmissions(
    @Query('status') status?: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Query('search') search?: string,
  ) {
    return this.adminSubmissionsService.listSubmissions(status, +page, +limit, search);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get submission detail' })
  getSubmission(@Param('id') id: string) {
    return this.adminSubmissionsService.getSubmission(id);
  }

  @Patch(':id/approve')
  @ApiOperation({ summary: 'Approve submission and create draft cafe' })
  approveSubmission(@Param('id') id: string, @Body('note') note?: string) {
    return this.adminSubmissionsService.approveSubmission(id, note);
  }

  @Patch(':id/reject')
  @ApiOperation({ summary: 'Reject submission' })
  rejectSubmission(@Param('id') id: string, @Body('note') note?: string) {
    return this.adminSubmissionsService.rejectSubmission(id, note);
  }

  @Patch(':id/hide')
  @ApiOperation({ summary: 'Hide submission' })
  hideSubmission(@Param('id') id: string) {
    return this.adminSubmissionsService.hideSubmission(id);
  }
}
