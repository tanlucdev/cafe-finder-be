import { Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
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
  listSubmissions(@Query('status') status?: string) {
    return this.adminSubmissionsService.listSubmissions(status);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get submission detail' })
  getSubmission(@Param('id') id: string) {
    return this.adminSubmissionsService.getSubmission(id);
  }

  @Patch(':id/approve')
  @ApiOperation({ summary: 'Approve submission and create draft cafe' })
  approveSubmission(@Param('id') id: string) {
    return this.adminSubmissionsService.approveSubmission(id);
  }

  @Patch(':id/reject')
  @ApiOperation({ summary: 'Reject submission' })
  rejectSubmission(@Param('id') id: string) {
    return this.adminSubmissionsService.rejectSubmission(id);
  }
}
