import { IsString, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResetPasswordDto {
  @ApiProperty({ description: 'Token received via email' })
  @IsString()
  token: string;

  @ApiProperty({ example: 'newpassword123', minLength: 6, maxLength: 50 })
  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters' })
  @MaxLength(50)
  newPassword: string;
}
