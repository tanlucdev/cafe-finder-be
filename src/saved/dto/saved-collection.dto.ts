import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateSavedCollectionDto {
  @ApiProperty({ example: 'Want to try' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  name: string;
}

export class RenameSavedCollectionDto {
  @ApiProperty({ example: 'Date spots' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  name: string;
}

export class MoveSavedCafeDto {
  @ApiPropertyOptional({ example: 'Want to try', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  collectionName?: string | null;
}
