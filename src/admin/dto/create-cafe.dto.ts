import {
  IsString,
  IsOptional,
  IsArray,
  IsBoolean,
  IsNumber,
  Min,
  Max,
  MaxLength,
  IsUrl,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateCafeDto {
  @ApiProperty({ example: 'The Workshop Coffee' })
  @IsString()
  @MaxLength(200)
  name: string;

  @ApiPropertyOptional({ description: 'Tự generate từ name nếu không truyền' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  slug?: string;

  @ApiPropertyOptional({ example: '27 Ngô Đức Kế, Quận 1' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @ApiPropertyOptional({ example: 'Quận 1' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  district?: string;

  @ApiPropertyOptional({ example: 10.7761 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lat?: number;

  @ApiPropertyOptional({ example: 106.7026 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lng?: number;

  @ApiPropertyOptional({ example: '07:00 - 22:00' })
  @IsOptional()
  @IsString()
  openingHours?: string;

  @ApiPropertyOptional({ enum: ['under_50k', 'price_50k_100k', 'price_100k_150k', 'above_150k'] })
  @IsOptional()
  @IsString()
  priceRange?: string;

  @ApiPropertyOptional({ example: 'Không gian công nghiệp ấn tượng' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  oneLiner?: string;

  @ApiPropertyOptional({ type: [String], example: ['Cozy', 'Vintage'] })
  @IsOptional()
  @IsArray()
  vibe?: string[];

  @ApiPropertyOptional({ type: [String], example: ['Work', 'Date'] })
  @IsOptional()
  @IsArray()
  purpose?: string[];

  @ApiPropertyOptional({ example: 4.5 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(5)
  rating?: number;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  images?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  coverImage?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}
