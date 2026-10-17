import { Module } from '@nestjs/common';
import { AdminVotesController } from './admin-votes.controller';
import { AdminVotesService } from './admin-votes.service';

@Module({
  controllers: [AdminVotesController],
  providers: [AdminVotesService],
})
export class AdminVotesModule {}
