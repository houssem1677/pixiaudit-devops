import { IsUrl, IsOptional, IsObject } from 'class-validator';

export class CreateAuditDto {
  @IsUrl()
  url: string;

  @IsOptional()
  @IsObject()
  config?: Record<string, any>;
}
