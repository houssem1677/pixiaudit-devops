import { IsObject, IsNumber, Min, Max, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class ThresholdsDto {
  @IsNumber()
  @Min(0)
  @Max(100)
  good: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  ok: number;
}

class WeightsDto {
  @IsNumber()
  @Min(0)
  @Max(100)
  seo: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  performance: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  security: number;
}

// ✅ NEW - SEO Deductions DTO
class SeoDeductionsDto {
  @IsNumber()
  @Min(0)
  @Max(30)
  H1_MISSING: number;

  @IsNumber()
  @Min(0)
  @Max(30)
  META_MISSING: number;

  @IsNumber()
  @Min(0)
  @Max(30)
  TITLE_MISSING: number;

  @IsNumber()
  @Min(0)
  @Max(30)
  TITLE_TOO_SHORT: number;

  @IsNumber()
  @Min(0)
  @Max(30)
  TITLE_TOO_LONG: number;

  @IsNumber()
  @Min(0)
  @Max(30)
  META_TOO_SHORT: number;

  @IsNumber()
  @Min(0)
  @Max(30)
  META_TOO_LONG: number;

  @IsNumber()
  @Min(0)
  @Max(30)
  H1_MULTIPLE: number;
}

// ✅ NEW - Security Scoring DTO
class SecurityScoringDto {
  @IsNumber()
  @Min(0)
  @Max(100)
  sslValid: number;

  @IsNumber()
  @Min(-20)
  @Max(0)
  sslExpiringSoon: number;

  @IsNumber()
  @Min(0)
  @Max(20)
  headerPresent: number;

  @IsNumber()
  @Min(-30)
  @Max(0)
  headerMissing: number;
}

export class UpdateSettingsDto {
  @ValidateNested()
  @Type(() => ThresholdsDto)
  thresholds: ThresholdsDto;

  @ValidateNested()
  @Type(() => WeightsDto)
  weights: WeightsDto;

  @IsObject()
  anomalyLevels: Record<string, 'Critique' | 'Important' | 'Amélioration'>;

  // ✅ NEW - Scoring parameters (optional)
  @ValidateNested()
  @Type(() => SeoDeductionsDto)
  seoDeductions?: SeoDeductionsDto;

  @ValidateNested()
  @Type(() => SecurityScoringDto)
  securityScoring?: SecurityScoringDto;
}
