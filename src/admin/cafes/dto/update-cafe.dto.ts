import { PartialType } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString } from 'class-validator';
import { CreateCafeDto } from './create-cafe.dto';

export class UpdateCafeDto extends PartialType(CreateCafeDto) {
  @IsOptional()
  @IsString()
  menuImage?: string | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  menuImages?: string[] | null;
}
