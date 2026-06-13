import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';

function parseOptionalBoolean({ obj, key, value }: any) {
  const raw = obj?.[key] ?? value;

  if (raw === undefined || raw === null || raw === '') return undefined;
  if (raw === true || raw === 'true' || raw === 1 || raw === '1') return true;
  if (raw === false || raw === 'false' || raw === 0 || raw === '0') return false;

  return raw;
}

export class CreateCafeDto {
  @ApiProperty({ example: 'The Workshop Coffee' })
  @IsString()
  @MaxLength(200)
  name: string;

  @ApiPropertyOptional({ example: 'Morning Coffee' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  nameEn?: string | null;

  @ApiPropertyOptional({ description: 'Auto-generated from name if not provided' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  slug?: string;

  @ApiPropertyOptional({ example: '27 Ngo Duc Ke, District 1' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @ApiPropertyOptional({ example: '27 Ngo Duc Ke, Ben Nghe Ward, District 1' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  addressEn?: string | null;

  @ApiPropertyOptional({ example: 'District 1' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  district?: string;

  @ApiPropertyOptional({ example: 'District 1' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  districtEn?: string | null;

  @ApiPropertyOptional({ example: 10.7761, description: 'Latitude used to set PostGIS location' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lat?: number;

  @ApiPropertyOptional({ example: 106.7026, description: 'Longitude used to set PostGIS location' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lng?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  googlePlaceId?: string;

  @ApiPropertyOptional({ example: 'https://maps.google.com/...' })
  @IsOptional()
  @IsString()
  googleMapsUrl?: string;

  @ApiPropertyOptional({ example: '07:00' })
  @IsOptional()
  @IsString()
  openingTime?: string;

  @ApiPropertyOptional({ example: '22:00' })
  @IsOptional()
  @IsString()
  closingTime?: string;

  @ApiPropertyOptional({ example: 50000, description: 'Minimum price (VND)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  priceMin?: number;

  @ApiPropertyOptional({
    example: 100000,
    description: 'Maximum price (VND), null = above this range',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  priceMax?: number;

  @ApiPropertyOptional({ example: 'Impressive industrial space' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  oneLiner?: string;

  @ApiPropertyOptional({ example: 'A striking industrial space for specialty coffee' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  oneLinerEn?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  descriptionEn?: string | null;

  @ApiPropertyOptional({ example: 'Cold Brew' })
  @IsOptional()
  @IsString()
  signatureDrink?: string;

  @ApiPropertyOptional({ example: 'Cold Brew' })
  @IsOptional()
  @IsString()
  signatureDrinkEn?: string | null;

  @ApiPropertyOptional({ type: [String], example: ['quiet', 'vintage'] })
  @IsOptional()
  @IsArray()
  vibes?: string[];

  @ApiPropertyOptional({ type: [String], example: ['quiet', 'vintage'] })
  @IsOptional()
  @IsArray()
  vibesEn?: string[];

  @ApiPropertyOptional({ type: [String], example: ['work', 'study'] })
  @IsOptional()
  @IsArray()
  purposes?: string[];

  @ApiPropertyOptional({ type: [String], example: ['work', 'study'] })
  @IsOptional()
  @IsArray()
  purposesEn?: string[];

  @ApiPropertyOptional({ type: [String], example: ['wifi', 'power outlets'] })
  @IsOptional()
  @IsArray()
  amenities?: string[];

  @ApiPropertyOptional({ type: [String], example: ['wifi', 'power outlets'] })
  @IsOptional()
  @IsArray()
  amenitiesEn?: string[];

  @ApiPropertyOptional({ type: [String], example: ['outdoor', 'smoking'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ type: [String], example: ['outdoor', 'smoking'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tagsEn?: string[];

  @ApiPropertyOptional({ example: 'Basement parking available' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  parkingLocation?: string | null;

  @ApiPropertyOptional({ example: 'Basement parking available' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  parkingLocationEn?: string | null;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  images?: string[];

  @ApiPropertyOptional({ type: [String], example: ['landscape', 'portrait'] })
  @IsOptional()
  @IsArray()
  imageOrientations?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  coverImage?: string;

  @ApiPropertyOptional({ description: 'Dedicated cafe menu image URL' })
  @IsOptional()
  @IsString()
  menuImage?: string | null;

  @ApiPropertyOptional({ example: 'https://instagram.com/...' })
  @IsOptional()
  @IsString()
  instagramUrl?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @Transform(parseOptionalBoolean)
  @IsBoolean()
  isFeatured?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => {
    if (value === null || value === '' || value === undefined || value === 0 || value === '0') {
      return null;
    }
    const n = Number(value);
    return isNaN(n) ? null : n;
  })
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsInt()
  @Min(1)
  featuredOrder?: number | null;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @Transform(parseOptionalBoolean)
  @IsBoolean()
  isPublished?: boolean;
}
