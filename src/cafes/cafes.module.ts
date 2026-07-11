import { Module } from '@nestjs/common';
import { CafesController } from './cafes.controller';
import { CafesService } from './cafes.service';
import { RouteDistanceService } from './route-distance.service';
import { CafeVotesService } from './cafe-votes.service';

@Module({
  controllers: [CafesController],
  providers: [CafesService, RouteDistanceService, CafeVotesService],
  exports: [CafesService],
})
export class CafesModule {}
