import { IsEmail, IsIn, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ForgotPasswordDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail({}, { message: 'Invalid email address' })
  email: string;

  @ApiPropertyOptional({ enum: ['vi', 'en'], example: 'vi' })
  @IsOptional()
  @IsIn(['vi', 'en'])
  locale?: 'vi' | 'en';
}
