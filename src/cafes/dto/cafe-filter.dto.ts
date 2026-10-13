import {
  IsOptional,
  IsString,
  IsArray,
  IsInt,
  Min,
  Max,
  IsIn,
  IsBoolean,
  IsNumber,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CafeFilterDto {
  @ApiPropertyOptional({ enum: ['vi', 'en'], default: 'vi' })
  @IsOptional()
  @IsIn(['vi', 'en'])
  locale?: 'vi' | 'en';

  @ApiPropertyOptional({ enum: ['popular', 'rating', 'newest'], default: 'popular' })
  @IsOptional()
  @IsIn(['popular', 'rating', 'newest'])
  sort?: 'popular' | 'rating' | 'newest';

  @ApiPropertyOptional({ example: 'District 1' })
  @IsOptional()
  @IsString()
  district?: string;

  @ApiPropertyOptional({
    example: 'Quận 1,Quận 3',
    description: 'Comma-separated districts. Takes precedence over district when non-empty.',
  })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string'
      ? [
          ...new Set(
            value
              .split(',')
              .map((district) => district.trim())
              .filter(Boolean),
          ),
        ]
      : value,
  )
  @IsArray()
  @IsString({ each: true })
  districts?: string[];

  @ApiPropertyOptional({ example: 10.77 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat?: number;

  @ApiPropertyOptional({ example: 106.7 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng?: number;

  @ApiPropertyOptional({ default: 2, maximum: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.1)
  @Max(50)
  radius?: number;

  @ApiPropertyOptional({ enum: ['straight', 'route'], default: 'route' })
  @IsOptional()
  @IsIn(['straight', 'route'])
  distanceMode?: 'straight' | 'route';

  @ApiPropertyOptional({ example: 'highland' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    enum: ['under_50k', 'price_50k_100k', 'price_100k_150k', 'above_150k'],
    description: 'Filter by price range',
  })
  @IsOptional()
  @IsString()
  priceRange?: string;

  @ApiPropertyOptional({ default: false, description: 'Only return cafes open now' })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  openNow?: boolean;

  @ApiPropertyOptional({
    enum: ['open_at_7', 'open_24h'],
    description:
      'open_at_7 opens exactly at 07:00; open_24h has matching opening and closing times.',
  })
  @IsOptional()
  @Transform(({ value }) => (value === 'from_7' ? 'open_at_7' : value))
  @IsIn(['open_at_7', 'open_24h'])
  hours?: 'open_at_7' | 'open_24h';

  @ApiPropertyOptional({ example: 'quiet,vintage', description: 'Comma-separated vibes' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.split(',').filter(Boolean) : value))
  @IsArray()
  vibes?: string[];

  @ApiPropertyOptional({ example: 'work,study', description: 'Comma-separated purposes' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.split(',').filter(Boolean) : value))
  @IsArray()
  purposes?: string[];

  @ApiPropertyOptional({ example: 'outdoor,smoking', description: 'Comma-separated tags' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.split(',').filter(Boolean) : value))
  @IsArray()
  tags?: string[];

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 12 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 12;
}
