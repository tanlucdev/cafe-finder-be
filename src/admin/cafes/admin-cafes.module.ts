import { Module } from '@nestjs/common';
import { StorageModule } from '../../storage/storage.module';
import { AdminCafesController } from './admin-cafes.controller';
import { AdminCafesService } from './admin-cafes.service';

@Module({
  imports: [StorageModule],
  controllers: [AdminCafesController],
  providers: [AdminCafesService],
})
export class AdminCafesModule {}
