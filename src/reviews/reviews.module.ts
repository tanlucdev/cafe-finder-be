import { Module } from '@nestjs/common';
import { MyReviewsController, ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';

@Module({
  controllers: [ReviewsController, MyReviewsController],
  providers: [ReviewsService],
})
export class ReviewsModule {}
