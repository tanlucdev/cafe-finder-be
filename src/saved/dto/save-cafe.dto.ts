import { IsString, IsOptional, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SaveCafeDto {
  @ApiProperty({ example: 'uuid-of-cafe' })
  @IsUUID()
  cafeId: string;

  @ApiPropertyOptional({ example: 'Quán yêu thích', default: 'Yêu thích' })
  @IsOptional()
  @IsString()
  collectionName?: string;
}
