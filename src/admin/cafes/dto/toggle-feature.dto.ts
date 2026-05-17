import { Transform } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ToggleFeatureDto {
  @ApiPropertyOptional({ description: 'Display order when featured' })
  @IsOptional()
  @Transform(({ value }) => (value === null || value === '' ? undefined : Number(value)))
  @IsInt()
  @Min(1)
  featuredOrder?: number;
}
