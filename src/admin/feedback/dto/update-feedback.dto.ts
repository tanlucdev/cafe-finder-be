import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class UpdateFeedbackDto {
  @ApiPropertyOptional({ enum: ['reviewed', 'archived', 'new'] })
  @IsOptional()
  @IsIn(['reviewed', 'archived', 'new'])
  status?: 'new' | 'reviewed' | 'archived';

  @ApiPropertyOptional()
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  adminNote?: string;
}
