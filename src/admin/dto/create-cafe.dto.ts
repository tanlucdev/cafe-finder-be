import {
  IsString,
  IsOptional,
  IsArray,
  IsBoolean,
  IsNumber,
  IsInt,
  Min,
  MaxLength,
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

  @ApiPropertyOptional({ example: 10.7761, description: 'Latitude — dùng để set PostGIS location' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lat?: number;

  @ApiPropertyOptional({ example: 106.7026, description: 'Longitude — dùng để set PostGIS location' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lng?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  googlePlaceId?: string;

  @ApiPropertyOptional({ example: 'https://maps.google.com/...' })
  @IsOptional()
  @IsString()
  googleMapsUrl?: string;

  @ApiPropertyOptional({ example: '07:00' })
  @IsOptional()
  @IsString()
  openingTime?: string;

  @ApiPropertyOptional({ example: '22:00' })
  @IsOptional()
  @IsString()
  closingTime?: string;

  @ApiPropertyOptional({ example: 50000, description: 'Giá tối thiểu (VND)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  priceMin?: number;

  @ApiPropertyOptional({ example: 100000, description: 'Giá tối đa (VND), null = trên mức này' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  priceMax?: number;

  @ApiPropertyOptional({ example: 'Không gian công nghiệp ấn tượng' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  oneLiner?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'Cold Brew' })
  @IsOptional()
  @IsString()
  signatureDrink?: string;

  @ApiPropertyOptional({ type: [String], example: ['yên tĩnh', 'vintage'] })
  @IsOptional()
  @IsArray()
  vibes?: string[];

  @ApiPropertyOptional({ type: [String], example: ['làm việc', 'học tập'] })
  @IsOptional()
  @IsArray()
  purposes?: string[];

  @ApiPropertyOptional({ type: [String], example: ['wifi', 'ổ cắm'] })
  @IsOptional()
  @IsArray()
  amenities?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  images?: string[];

  @ApiPropertyOptional({ type: [String], example: ['landscape', 'portrait'] })
  @IsOptional()
  @IsArray()
  imageOrientations?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  coverImage?: string;

  @ApiPropertyOptional({ example: 'https://instagram.com/...' })
  @IsOptional()
  @IsString()
  instagramUrl?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  featuredOrder?: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}
