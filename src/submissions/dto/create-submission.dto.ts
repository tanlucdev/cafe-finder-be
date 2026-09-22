import { IsIn, IsObject, IsString, IsOptional, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSubmissionDto {
  @ApiPropertyOptional({ enum: ['community', 'owner'], default: 'community' })
  @IsOptional()
  @IsIn(['community', 'owner'])
  submissionType?: 'community' | 'owner';

  @ApiProperty({ example: 'Hidden Gem Cafe' })
  @IsString()
  @MaxLength(200)
  name: string;

  @ApiPropertyOptional({ example: '123 ABC Street, District 1' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @ApiPropertyOptional({ example: 'https://maps.google.com/...' })
  @IsOptional()
  @IsString()
  googleMapsUrl?: string;

  @ApiPropertyOptional({ example: 'This cafe has a beautiful rooftop view' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;

  @ApiPropertyOptional({ description: 'Cafe detail draft payload' })
  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;
}
