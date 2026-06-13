import { PartialType } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { CreateCafeDto } from './create-cafe.dto';

export class UpdateCafeDto extends PartialType(CreateCafeDto) {
  @IsOptional()
  @IsString()
  menuImage?: string | null;
}
