import { IsString, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResetPasswordDto {
  @ApiProperty({ description: 'Token nhận được qua email' })
  @IsString()
  token: string;

  @ApiProperty({ example: 'newpassword123', minLength: 6, maxLength: 50 })
  @IsString()
  @MinLength(6, { message: 'Mật khẩu tối thiểu 6 ký tự' })
  @MaxLength(50)
  newPassword: string;
}
