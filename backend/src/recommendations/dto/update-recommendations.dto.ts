import { IsString } from 'class-validator';

export class UpdateRecommendationsDto {
  @IsString()
  recommendations!: string;
}