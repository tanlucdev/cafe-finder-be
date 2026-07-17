import { IsOptional, IsString } from 'class-validator';

export class OAuthStartDto {
  @IsOptional()
  @IsString()
  returnUrl?: string;
}
