import {
  BadRequestException,
  Body,
  Controller,
  FileValidator,
  Get,
  MaxFileSizeValidator,
  Param,
  ParseFilePipe,
  Patch,
  Post,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody, ApiConsumes } from '@nestjs/swagger';
import type {} from 'multer';
import { SubmissionsService } from './submissions.service';
import { CreateSubmissionDto } from './dto/create-submission.dto';
import { CreateCommunitySubmissionDto } from './dto/create-community-submission.dto';
import { JwtAuthGuard, OptionalJwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

type UploadedFile = Express.Multer.File;

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
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const MAX_BATCH_BYTES = 40 * 1024 * 1024;
const MAX_BATCH_IMAGES = 12;
const MAX_COMMUNITY_IMAGES = 8;

export class ImageUploadFileValidator extends FileValidator<Record<string, never>> {
  isValid(file?: UploadedFile): boolean {
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

export function validateBatchFiles(files: UploadedFile[]) {
  const validator = new ImageUploadFileValidator({});
  if (!files.length) throw new BadRequestException('At least one file is required');
  if (files.reduce((total, file) => total + file.size, 0) > MAX_BATCH_BYTES)
    throw new BadRequestException('Batch is too large');
  for (const file of files) {
    if (file.size > MAX_IMAGE_BYTES) throw new BadRequestException('File is too large');
    if (!validator.isValid(file)) throw new BadRequestException(validator.buildErrorMessage());
  }
}

export function validateCommunityFiles(files: UploadedFile[]) {
  const validator = new ImageUploadFileValidator({});
  if (files.length > MAX_COMMUNITY_IMAGES)
    throw new BadRequestException(`At most ${MAX_COMMUNITY_IMAGES} images are allowed`);
  if (files.reduce((total, file) => total + file.size, 0) > MAX_BATCH_BYTES)
    throw new BadRequestException('Batch is too large');
  for (const file of files) {
    if (file.size > MAX_IMAGE_BYTES) throw new BadRequestException('File is too large');
    if (!validator.isValid(file)) throw new BadRequestException(validator.buildErrorMessage());
  }
}

@ApiTags('Submissions')
@Controller('submissions')
@ApiBearerAuth()
export class SubmissionsController {
  constructor(private readonly submissionsService: SubmissionsService) {}

  @Post('community')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Submit a community cafe with optional images' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['name', 'googleMapsUrl'],
      properties: {
        name: { type: 'string' },
        googleMapsUrl: { type: 'string' },
        note: { type: 'string' },
        photos: { type: 'array', items: { type: 'string', format: 'binary' } },
      },
    },
  })
  @UseInterceptors(
    FilesInterceptor('photos', MAX_COMMUNITY_IMAGES, {
      limits: { files: MAX_COMMUNITY_IMAGES, fileSize: MAX_IMAGE_BYTES },
    }),
  )
  createCommunity(
    @CurrentUser() user: { id: string } | null,
    @Body() dto: CreateCommunitySubmissionDto,
    @UploadedFiles() files: UploadedFile[] = [],
  ) {
    validateCommunityFiles(files);
    return this.submissionsService.createCommunity(user?.id, dto, files);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Submit a new cafe for admin review' })
  create(@CurrentUser() user: any, @Body() dto: CreateSubmissionDto) {
    return this.submissionsService.create(user.id, dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Update current user cafe submission draft' })
  update(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: CreateSubmissionDto) {
    return this.submissionsService.update(user.id, id, dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'List current user cafe submissions' })
  getMe(@CurrentUser() user: any) {
    return this.submissionsService.getMe(user.id);
  }

  @Post(':id/submit')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Submit current user draft for admin review' })
  submit(@CurrentUser() user: any, @Param('id') id: string) {
    return this.submissionsService.submit(user.id, id);
  }

  @Post(':id/images')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Upload gallery image for current user submission' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } },
  })
  @UseInterceptors(FileInterceptor('file'))
  uploadImage(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: MAX_IMAGE_BYTES }),
          new ImageUploadFileValidator({}),
        ],
      }),
    )
    file: UploadedFile,
  ) {
    console.warn(JSON.stringify({ type: 'submission.multipart.deprecated', endpoint: 'images' }));
    return this.submissionsService.uploadImage(user.id, id, file, 'images');
  }

  @Post(':id/images/batch')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Upload gallery images for current user submission' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { files: { type: 'array', items: { type: 'string', format: 'binary' } } },
    },
  })
  @UseInterceptors(FilesInterceptor('files', MAX_BATCH_IMAGES))
  uploadImages(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @UploadedFiles() files: UploadedFile[],
  ) {
    console.warn(
      JSON.stringify({ type: 'submission.multipart.deprecated', endpoint: 'images.batch' }),
    );
    validateBatchFiles(files);
    return this.submissionsService.uploadImages(user.id, id, files, 'images');
  }

  @Post(':id/menu')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Upload menu image for current user submission' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } },
  })
  @UseInterceptors(FileInterceptor('file'))
  uploadMenuImage(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: MAX_IMAGE_BYTES }),
          new ImageUploadFileValidator({}),
        ],
      }),
    )
    file: UploadedFile,
  ) {
    console.warn(JSON.stringify({ type: 'submission.multipart.deprecated', endpoint: 'menu' }));
    return this.submissionsService.uploadImage(user.id, id, file, 'menuImages');
  }

  @Post(':id/menu/batch')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Upload menu images for current user submission' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { files: { type: 'array', items: { type: 'string', format: 'binary' } } },
    },
  })
  @UseInterceptors(FilesInterceptor('files', MAX_BATCH_IMAGES))
  uploadMenuImages(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @UploadedFiles() files: UploadedFile[],
  ) {
    console.warn(
      JSON.stringify({ type: 'submission.multipart.deprecated', endpoint: 'menu.batch' }),
    );
    validateBatchFiles(files);
    return this.submissionsService.uploadImages(user.id, id, files, 'menuImages');
  }
}
