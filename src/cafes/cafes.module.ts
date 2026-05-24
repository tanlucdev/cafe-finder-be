import { Module } from '@nestjs/common';
import { CafesController } from './cafes.controller';
import { CafesService } from './cafes.service';
import { RouteDistanceService } from './route-distance.service';

@Module({
  controllers: [CafesController],
  providers: [CafesService, RouteDistanceService],
  exports: [CafesService],
})
export class CafesModule {}
