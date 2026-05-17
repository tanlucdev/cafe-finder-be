import {
  Body,
  Controller,
  Delete,
  FileValidator,
  Get,
  MaxFileSizeValidator,
  Param,
  ParseFilePipe,
  Patch,
  Post,
  Put,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AdminCafesService } from './admin-cafes.service';
import { AdminCafeFilterDto } from './dto/admin-cafe-filter.dto';
import { CreateCafeDto } from './dto/create-cafe.dto';
import { DeleteCafeImageDto } from './dto/delete-cafe-image.dto';

import { ReorderCafeImagesDto } from './dto/reorder-cafe-images.dto';
import { ToggleFeatureDto } from './dto/toggle-feature.dto';
import { UpdateCafeDto } from './dto/update-cafe.dto';

const ACCEPTED_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'image/heic-sequence',
  'image/heif-sequence',
  'image/avif',
  'image/tiff',
]);

const ACCEPTED_IMAGE_EXTENSIONS = /\.(jpe?g|png|webp|heic|heics|heif|heifs|avif|tiff?)$/i;

class ImageUploadFileValidator extends FileValidator<Record<string, never>> {
  isValid(file?: Express.Multer.File): boolean {
    if (!file) return false;
    return (
      ACCEPTED_IMAGE_MIME_TYPES.has(file.mimetype) ||
      ACCEPTED_IMAGE_EXTENSIONS.test(file.originalname)
    );
  }

  buildErrorMessage(): string {
    return 'File must be a JPEG, PNG, WebP, HEIC, HEIF, AVIF, or TIFF image';
  }
}

@ApiTags('Admin Cafes')
@Controller('admin/cafes')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@ApiBearerAuth()
export class AdminCafesController {
  constructor(private readonly adminCafesService: AdminCafesService) {}

  @Get()
  @ApiOperation({ summary: 'List cafes with admin filters' })
  listCafes(@Query() filter: AdminCafeFilterDto) {
    return this.adminCafesService.listCafes(filter);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get single cafe detail' })
  getCafe(@Param('id') id: string) {
    return this.adminCafesService.getCafe(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new cafe' })
  createCafe(@Body() dto: CreateCafeDto) {
    return this.adminCafesService.createCafe(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update cafe' })
  updateCafe(@Param('id') id: string, @Body() dto: UpdateCafeDto) {
    return this.adminCafesService.updateCafe(id, dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update cafe (legacy alias)' })
  replaceCafe(@Param('id') id: string, @Body() dto: UpdateCafeDto) {
    return this.adminCafesService.updateCafe(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete cafe' })
  deleteCafe(@Param('id') id: string) {
    return this.adminCafesService.deleteCafe(id);
  }

  @Patch(':id/publish')
  @ApiOperation({ summary: 'Toggle cafe publish/unpublish' })
  togglePublish(@Param('id') id: string) {
    return this.adminCafesService.togglePublish(id);
  }

  @Patch(':id/feature')
  @ApiOperation({ summary: 'Toggle cafe featured state and featured order' })
  toggleFeature(@Param('id') id: string, @Body() dto: ToggleFeatureDto) {
    return this.adminCafesService.toggleFeature(id, dto.featuredOrder);
  }

  @Post(':id/images')
  @ApiOperation({ summary: 'Upload image for cafe' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } },
  })
  @UseInterceptors(FileInterceptor('file'))
  uploadImage(
    @Param('id') id: string,
    @Query('cover') cover: string,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 25 * 1024 * 1024 }),
          new ImageUploadFileValidator({}),
        ],
      }),
    )
    file: Express.Multer.File,
  ) {
    return this.adminCafesService.uploadCafeImage(id, file, cover === 'true');
  }

  @Delete(':id/images')
  @ApiOperation({ summary: 'Delete image from cafe' })
  deleteImage(@Param('id') id: string, @Body() dto: DeleteCafeImageDto) {
    return this.adminCafesService.deleteCafeImage(id, dto.imageUrl);
  }

  @Patch(':id/images/reorder')
  @ApiOperation({ summary: 'Reorder cafe images' })
  reorderImages(@Param('id') id: string, @Body() dto: ReorderCafeImagesDto) {
    return this.adminCafesService.reorderCafeImages(id, dto.imageUrls);
  }
}
