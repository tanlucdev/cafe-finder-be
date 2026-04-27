import { Module } from '@nestjs/common';
import { CafesController } from './cafes.controller';
import { CafesService } from './cafes.service';

@Module({
  controllers: [CafesController],
  providers: [CafesService],
  exports: [CafesService],
})
export class CafesModule {}
