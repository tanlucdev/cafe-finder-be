import { Module } from '@nestjs/common';
import { AdminCafesModule } from './cafes/admin-cafes.module';
import { AdminBlogsModule } from './blogs/admin-blogs.module';
import { AdminStatsModule } from './stats/admin-stats.module';
import { AdminSubmissionsModule } from './submissions/admin-submissions.module';
import { AdminUsersModule } from './users/admin-users.module';

@Module({
  imports: [
    AdminCafesModule,
    AdminBlogsModule,
    AdminSubmissionsModule,
    AdminUsersModule,
    AdminStatsModule,
  ],
})
export class AdminModule {}
