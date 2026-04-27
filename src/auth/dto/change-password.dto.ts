import { IsString, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ChangePasswordDto {
  @ApiProperty({ example: 'oldpass123' })
  @IsString()
  currentPassword: string;

  @ApiProperty({ example: 'newpass456', minLength: 6 })
  @IsString()
  @MinLength(6)
  @MaxLength(50)
  newPassword: string;
}
