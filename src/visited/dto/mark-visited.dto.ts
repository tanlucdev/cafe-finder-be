import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class MarkVisitedDto {
  @ApiProperty({ example: 'uuid-of-cafe' })
  @IsUUID()
  cafeId: string;
}
