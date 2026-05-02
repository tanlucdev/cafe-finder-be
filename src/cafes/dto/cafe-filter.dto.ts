import { IsOptional, IsString, IsArray, IsInt, Min, Max } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CafeFilterDto {
  @ApiPropertyOptional({ example: 'Quận 1' })
  @IsOptional()
  @IsString()
  district?: string;

  @ApiPropertyOptional({ example: 'highland' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    enum: ['under_50k', 'price_50k_100k', 'price_100k_150k', 'above_150k'],
    description: 'Lọc theo khoảng giá',
  })
  @IsOptional()
  @IsString()
  priceRange?: string;

  @ApiPropertyOptional({ example: 'yên tĩnh,vintage', description: 'Comma-separated vibes' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.split(',').filter(Boolean) : value))
  @IsArray()
  vibes?: string[];

  @ApiPropertyOptional({ example: 'làm việc,học tập', description: 'Comma-separated purposes' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.split(',').filter(Boolean) : value))
  @IsArray()
  purposes?: string[];

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
