import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { BlogSectionDto } from './blog-section.dto';

export class CreateBlogPostDto {
  @ApiProperty({ example: 'mot-buoi-sang-cham-o-thao-dien' })
  @IsOptional()
  @IsString()
  @MaxLength(220)
  slug?: string;

  @ApiPropertyOptional({ example: '/image/home-polaroid-1.jpg' })
  @IsOptional()
  @IsString()
  heroImage?: string | null;

  @ApiPropertyOptional({ enum: ['amber', 'sage', 'rose'], default: 'amber' })
  @IsOptional()
  @IsIn(['amber', 'sage', 'rose'])
  accent?: string;

  @ApiPropertyOptional({ type: [String], example: ['morning', 'quiet'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiProperty()
  @IsString()
  @MaxLength(240)
  titleVi: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(240)
  titleEn?: string | null;

  @ApiProperty()
  @IsString()
  @MaxLength(700)
  excerptVi: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(700)
  excerptEn?: string | null;

  @ApiProperty()
  @IsString()
  @MaxLength(120)
  categoryVi: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  categoryEn?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  readTimeVi?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  readTimeEn?: string | null;

  @ApiPropertyOptional({ default: 'Cafe Maps Editorial' })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  author?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  moodVi?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  moodEn?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  locationVi?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  locationEn?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(240)
  heroImageAltVi?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(240)
  heroImageAltEn?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  introVi?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  introEn?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  pullQuoteVi?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  pullQuoteEn?: string | null;

  @ApiPropertyOptional({ type: [BlogSectionDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BlogSectionDto)
  sectionsVi?: BlogSectionDto[];

  @ApiPropertyOptional({ type: [BlogSectionDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BlogSectionDto)
  sectionsEn?: BlogSectionDto[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  checklistVi?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  checklistEn?: string[];

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsInt()
  @Min(1)
  featuredOrder?: number | null;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;

  @ApiPropertyOptional({ example: '2026-05-26T08:00:00.000Z' })
  @IsOptional()
  @IsISO8601()
  publishedAt?: string | null;
}
