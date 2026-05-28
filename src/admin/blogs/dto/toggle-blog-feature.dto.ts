import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsInt, IsOptional, Min, ValidateIf } from 'class-validator';

export class ToggleBlogFeatureDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => {
    if (value === null || value === '' || value === undefined) return null;
    const n = Number(value);
    return Number.isNaN(n) ? null : n;
  })
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsInt()
  @Min(1)
  featuredOrder?: number | null;
}
