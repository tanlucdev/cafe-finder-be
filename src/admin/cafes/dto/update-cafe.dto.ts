import { PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { CreateCafeDto } from './create-cafe.dto';

export class UpdateCafeDto extends PartialType(CreateCafeDto) {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  viewCount?: number;

  @IsOptional()
  @IsString()
  menuImage?: string | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  menuImages?: string[] | null;
}
