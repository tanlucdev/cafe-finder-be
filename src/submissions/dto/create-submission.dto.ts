import { IsString, IsOptional, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSubmissionDto {
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
}
