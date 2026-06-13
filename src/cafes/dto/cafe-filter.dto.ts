import { IsOptional, IsString, IsArray, IsInt, Min, Max, IsIn, IsBoolean } from 'class-validator';
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
