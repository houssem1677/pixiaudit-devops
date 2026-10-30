import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RecommendationsService } from './recommendations.service';
import { RecommendationsController } from './recommendations.controller';
import { Audit } from '../audit/entities/audit.entity';
import { RecommendationHistory } from './entities/recommendation-history.entity';

@Module({
  imports: [
    HttpModule,
    TypeOrmModule.forFeature([Audit, RecommendationHistory]), // ✅ NEW: Added RecommendationHistory
  ],
  controllers: [RecommendationsController],
  providers: [RecommendationsService],
  exports: [RecommendationsService],
})
export class RecommendationsModule {}
