import { Module } from '@nestjs/common';
import { AdminCafesModule } from './cafes/admin-cafes.module';
import { AdminBlogsModule } from './blogs/admin-blogs.module';
import { AdminStatsModule } from './stats/admin-stats.module';
import { AdminSubmissionsModule } from './submissions/admin-submissions.module';
import { AdminUsersModule } from './users/admin-users.module';
import { AdminFeedbackModule } from './feedback/admin-feedback.module';
import { AdminReviewsModule } from './reviews/admin-reviews.module';
import { AdminVotesModule } from './votes/admin-votes.module';

@Module({
  imports: [
    AdminCafesModule,
    AdminBlogsModule,
    AdminSubmissionsModule,
    AdminUsersModule,
    AdminStatsModule,
    AdminFeedbackModule,
    AdminReviewsModule,
    AdminVotesModule,
  ],
})
export class AdminModule {}
