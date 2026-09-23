import { Body, Controller, Delete, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SubmissionAssetsService } from './submission-assets.service';

@ApiTags('Submissions')
@Controller('submissions')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SubmissionAssetsController {
  constructor(private readonly assets: SubmissionAssetsService) {}

  @Post(':id/assets/signatures')
  @ApiOperation({ summary: 'Sign direct Cloudinary owner-draft uploads' })
  signatures(@CurrentUser() user: any, @Param('id') id: string, @Body() body: any) {
    return this.assets.signatures(user.id, id, body?.assets);
  }

  @Post(':id/assets')
  @ApiOperation({ summary: 'Persist a direct Cloudinary owner-draft upload' })
  persist(@CurrentUser() user: any, @Param('id') id: string, @Body() body: any) {
    return this.assets.persist(user.id, id, body ?? {});
  }

  @Delete(':id/assets')
  @ApiOperation({ summary: 'Delete a direct Cloudinary owner-draft upload' })
  remove(@CurrentUser() user: any, @Param('id') id: string, @Body() body: any) {
    return this.assets.remove(user.id, id, body?.public_id);
  }
}
