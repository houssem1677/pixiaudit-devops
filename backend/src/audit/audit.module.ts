import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';
import { AuditProcessor } from './audit.processor';
import { ScraperService } from './scraper.service';
import { RecommendationsModule } from '../recommendations/recommendations.module';
import { SettingsModule } from '../settings/settings.module';
import { PdfModule } from '../pdf/pdf.module'; 
import { Audit } from './entities/audit.entity';
import { CrawledPage } from './entities/crawled-page.entity';
import { SeoResult } from './entities/seo-result.entity';
import { PerformanceResult } from './entities/performance-result.entity';
import { SecurityResult } from './entities/security-result.entity';

@Module({
  imports: [
    HttpModule.register({ timeout: 30 * 60 * 1000 }),
    TypeOrmModule.forFeature([
      Audit,
      CrawledPage,
      SeoResult,
      PerformanceResult,
      SecurityResult,
    ]),
    BullModule.registerQueue({
      name: 'audit',
    }),
    RecommendationsModule,
    SettingsModule,
    PdfModule, 
  ],
  controllers: [AuditController],
  providers:   [AuditService, AuditProcessor, ScraperService],
  exports:     [AuditService],
})
export class AuditModule {}