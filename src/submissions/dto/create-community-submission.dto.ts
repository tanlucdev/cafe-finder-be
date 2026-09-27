import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCommunitySubmissionDto {
  @ApiProperty({ example: 'Hidden Gem Cafe' })
  @IsString()
  @MaxLength(200)
  name: string;

  @ApiProperty({ example: 'https://maps.google.com/...' })
  @IsString()
  @MaxLength(2000)
  googleMapsUrl: string;

  @ApiPropertyOptional({ example: 'This cafe has a beautiful rooftop view' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}
