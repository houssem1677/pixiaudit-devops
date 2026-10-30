import {
  IsEmail,
  IsString,
  MinLength,
  IsEnum,
  IsOptional,
  IsBoolean,
} from 'class-validator';
import { Role } from '../user.entity';

export class UpdateUserDto {
  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @MinLength(8)
  @IsOptional()
  password?: string;

  @IsString()
  @IsOptional()
  name?: string;

  @IsEnum(Role)
  @IsOptional()
  role?: Role;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
