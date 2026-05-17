import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsString } from 'class-validator';

export class ReorderCafeImagesDto {
  @ApiProperty({
    type: [String],
    description: 'All existing image URLs in the desired display order',
    example: ['https://cdn.test/cafes/id/b.webp', 'https://cdn.test/cafes/id/a.webp'],
  })
  @IsArray()
  @IsString({ each: true })
  imageUrls: string[];
}
