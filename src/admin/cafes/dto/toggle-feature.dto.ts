import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ToggleFeatureDto {
  @ApiPropertyOptional({ description: 'Display order when featured' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  featuredOrder?: number;
}
