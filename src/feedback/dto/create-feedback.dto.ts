import { Transform } from 'class-transformer';
import { IsEmail, IsIn, IsOptional, IsString, IsUrl, IsUUID, Length } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CreateFeedbackDto {
  @ApiProperty({ enum: ['idea', 'bug', 'content', 'other'] })
  @IsIn(['idea', 'bug', 'content', 'other'])
  type: string;

  @ApiProperty({ minLength: 10, maxLength: 2000 })
  @Transform(trim)
  @IsString()
  @Length(10, 2000)
  message: string;

  @ApiPropertyOptional()
  @Transform(trim)
  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @ApiPropertyOptional()
  @Transform(trim)
  @IsOptional()
  @IsUrl({ require_tld: false })
  pageUrl?: string;

  @ApiPropertyOptional()
  @Transform(trim)
  @IsOptional()
  @IsUUID()
  cafeId?: string;
}
