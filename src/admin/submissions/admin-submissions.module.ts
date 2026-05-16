import { Module } from '@nestjs/common';
import { AdminSubmissionsController } from './admin-submissions.controller';
import { AdminSubmissionsService } from './admin-submissions.service';

@Module({
  controllers: [AdminSubmissionsController],
  providers: [AdminSubmissionsService],
})
export class AdminSubmissionsModule {}
