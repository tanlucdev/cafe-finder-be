import { Transform } from 'class-transformer';
import { IsInt, IsOptional, Min, ValidateIf } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ToggleFeatureDto {
  @ApiPropertyOptional({ description: 'Display order when featured' })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === null || value === '' || value === undefined || value === 0 || value === '0') {
      return null;
    }
    const n = Number(value);
    return Number.isNaN(n) ? null : n;
  })
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsInt()
  @Min(1)
  featuredOrder?: number | null;
}
