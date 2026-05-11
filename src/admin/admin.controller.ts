import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiQuery } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { CreateCafeDto } from './dto/create-cafe.dto';
import { UpdateCafeDto } from './dto/update-cafe.dto';
import { ReviewSubmissionDto } from './dto/review-submission.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('Admin')
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@ApiBearerAuth()
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // ── Cafes ──

  @Get('cafes')
  @ApiOperation({ summary: 'All cafes (including unpublished)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getAllCafes(@Query('page') page: number = 1, @Query('limit') limit: number = 20) {
    return this.adminService.getAllCafes(+page, +limit);
  }

  @Post('cafes')
  @ApiOperation({ summary: 'Create a new cafe' })
  createCafe(@Body() dto: CreateCafeDto) {
    return this.adminService.createCafe(dto);
  }

  @Put('cafes/:id')
  @ApiOperation({ summary: 'Update cafe details' })
  updateCafe(@Param('id') id: string, @Body() dto: UpdateCafeDto) {
    return this.adminService.updateCafe(id, dto);
  }

  @Delete('cafes/:id')
  @ApiOperation({ summary: 'Delete a cafe' })
  deleteCafe(@Param('id') id: string) {
    return this.adminService.deleteCafe(id);
  }

  @Patch('cafes/:id/publish')
  @ApiOperation({ summary: 'Toggle cafe publish/unpublish' })
  togglePublish(@Param('id') id: string) {
    return this.adminService.togglePublish(id);
  }

  @Post('cafes/:id/images')
  @ApiOperation({ summary: 'Upload image for a cafe' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  uploadImage(@Param('id') id: string, @UploadedFile() file: Express.Multer.File) {
    return this.adminService.uploadCafeImage(id, file);
  }

  // ── Submissions ──

  @Get('submissions')
  @ApiOperation({ summary: 'List cafe submissions' })
  @ApiQuery({ name: 'status', required: false, enum: ['pending', 'approved', 'rejected'] })
  getSubmissions(@Query('status') status?: string) {
    return this.adminService.getSubmissions(status);
  }

  @Patch('submissions/:id')
  @ApiOperation({ summary: 'Approve or reject a submission' })
  reviewSubmission(@Param('id') id: string, @Body() dto: ReviewSubmissionDto) {
    return this.adminService.reviewSubmission(id, dto);
  }
}
