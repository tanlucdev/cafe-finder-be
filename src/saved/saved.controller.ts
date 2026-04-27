import { Controller, Get, Post, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SavedService } from './saved.service';
import { SaveCafeDto } from './dto/save-cafe.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Saved')
@Controller('saved')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SavedController {
  constructor(private readonly savedService: SavedService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách quán đã lưu' })
  getSaved(@CurrentUser() user: any) {
    return this.savedService.getSaved(user.id);
  }

  @Get('collections')
  @ApiOperation({ summary: 'Danh sách collections của user' })
  getCollections(@CurrentUser() user: any) {
    return this.savedService.getCollections(user.id);
  }

  @Post()
  @ApiOperation({ summary: 'Lưu quán vào danh sách' })
  save(@CurrentUser() user: any, @Body() dto: SaveCafeDto) {
    return this.savedService.save(user.id, dto);
  }

  @Delete(':cafeId')
  @ApiOperation({ summary: 'Xóa quán khỏi danh sách đã lưu' })
  remove(@CurrentUser() user: any, @Param('cafeId') cafeId: string) {
    return this.savedService.remove(user.id, cafeId);
  }
}
