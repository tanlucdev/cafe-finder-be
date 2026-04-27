import { IsString, IsOptional, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSubmissionDto {
  @ApiProperty({ example: 'Cafe Ẩn Mình' })
  @IsString()
  @MaxLength(200)
  name: string;

  @ApiPropertyOptional({ example: '123 Đường ABC, Quận 1' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @ApiPropertyOptional({ example: 'https://maps.google.com/...' })
  @IsOptional()
  @IsString()
  googleMapsUrl?: string;

  @ApiPropertyOptional({ example: 'Quán này có view sân thượng đẹp lắm' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}
