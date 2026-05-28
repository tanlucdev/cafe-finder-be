import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';

export class BlogSectionDto {
  @ApiProperty({ example: 'Bắt đầu bằng ánh sáng' })
  @IsString()
  @MaxLength(180)
  heading: string;

  @ApiProperty({ example: 'Chọn bàn gần cửa sổ hoặc hiên nhỏ...' })
  @IsString()
  body: string;
}
