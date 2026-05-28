import { Module } from '@nestjs/common';
import { AdminBlogsController } from './admin-blogs.controller';
import { AdminBlogsService } from './admin-blogs.service';

@Module({
  controllers: [AdminBlogsController],
  providers: [AdminBlogsService],
})
export class AdminBlogsModule {}
