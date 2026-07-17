import { Module } from '@nestjs/common';
import { VisitedController } from './visited.controller';
import { VisitedService } from './visited.service';

@Module({
  controllers: [VisitedController],
  providers: [VisitedService],
})
export class VisitedModule {}
