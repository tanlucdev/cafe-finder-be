import { Module } from '@nestjs/common';
import { StorageModule } from '../../storage/storage.module';
import { AdminCafesController } from './admin-cafes.controller';
import { AdminCafesService } from './admin-cafes.service';
import { CafeRevalidateService } from './cafe-revalidate.service';

@Module({
  imports: [StorageModule],
  controllers: [AdminCafesController],
  providers: [AdminCafesService, CafeRevalidateService],
})
export class AdminCafesModule {}
