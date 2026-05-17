import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class DeleteCafeImageDto {
  @ApiProperty({
    example: 'https://example.com/storage/v1/object/public/cafe-images/cafes/id/image.webp',
  })
  @IsString()
  imageUrl: string;
}
