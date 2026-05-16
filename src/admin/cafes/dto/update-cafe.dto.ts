import { PartialType } from '@nestjs/swagger';
import { CreateCafeDto } from './create-cafe.dto';

export class UpdateCafeDto extends PartialType(CreateCafeDto) {}
