import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsOptional, IsString } from 'class-validator';

export class ImportCafeImagesDto {
  @ApiPropertyOptional({ type: [String], example: ['https://example.com/cafe.jpg'] })
  @IsArray()
  @IsString({ each: true })
  urls: string[];

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  cover?: boolean;
}
