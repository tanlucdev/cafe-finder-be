import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { QuizService } from './quiz.service';

@ApiTags('Quiz')
@Controller('quiz')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class QuizController {
  constructor(private readonly quizService: QuizService) {}

  @Post('completions')
  @ApiOperation({ summary: 'Record quiz completion' })
  recordCompletion(@CurrentUser() user: { id: string }) {
    return this.quizService.recordCompletion(user.id);
  }

  @Get('me')
  @ApiOperation({ summary: 'Get current user quiz stats' })
  getMe(@CurrentUser() user: { id: string }) {
    return this.quizService.getMe(user.id);
  }
}
