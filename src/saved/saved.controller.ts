import { Controller, Get, Post, Delete, Param, Body, UseGuards, Query, Patch } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SavedService } from './saved.service';
import { SaveCafeDto } from './dto/save-cafe.dto';
import { CreateSavedCollectionDto, MoveSavedCafeDto, RenameSavedCollectionDto } from './dto/saved-collection.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Saved')
@Controller('saved')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SavedController {
  constructor(private readonly savedService: SavedService) {}

  @Get()
  @ApiOperation({ summary: 'Get saved cafes' })
  getSaved(@CurrentUser() user: any, @Query('locale') locale?: string) {
    return this.savedService.getSaved(user.id, locale);
  }

  @Get('collections')
  @ApiOperation({ summary: "List user's collections" })
  getCollections(@CurrentUser() user: any) {
    return this.savedService.getCollections(user.id);
  }

  @Post('collections')
  @ApiOperation({ summary: 'Create a saved collection' })
  createCollection(@CurrentUser() user: any, @Body() dto: CreateSavedCollectionDto) {
    return this.savedService.createCollection(user.id, dto.name);
  }

  @Patch('collections/:name')
  @ApiOperation({ summary: 'Rename a saved collection' })
  renameCollection(
    @CurrentUser() user: any,
    @Param('name') name: string,
    @Body() dto: RenameSavedCollectionDto,
  ) {
    return this.savedService.renameCollection(user.id, name, dto.name);
  }

  @Delete('collections/:name')
  @ApiOperation({ summary: 'Delete a saved collection' })
  deleteCollection(@CurrentUser() user: any, @Param('name') name: string) {
    return this.savedService.deleteCollection(user.id, name);
  }

  @Post()
  @ApiOperation({ summary: 'Save a cafe' })
  save(@CurrentUser() user: any, @Body() dto: SaveCafeDto) {
    return this.savedService.save(user.id, dto);
  }

  @Delete(':cafeId')
  @ApiOperation({ summary: 'Remove a cafe from saved list' })
  remove(@CurrentUser() user: any, @Param('cafeId') cafeId: string) {
    return this.savedService.remove(user.id, cafeId);
  }

  @Patch(':cafeId/collection')
  @ApiOperation({ summary: 'Move a saved cafe to a collection' })
  moveToCollection(
    @CurrentUser() user: any,
    @Param('cafeId') cafeId: string,
    @Body() dto: MoveSavedCafeDto,
  ) {
    return this.savedService.moveToCollection(user.id, cafeId, dto.collectionName);
  }
}
