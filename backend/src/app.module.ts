
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { APP_GUARD } from '@nestjs/core';
import { readFileSync } from 'node:fs';

import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { User } from './users/user.entity';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';
import { AuditModule } from './audit/audit.module';
import { RecommendationsModule } from './recommendations/recommendations.module';
import { SettingsModule } from './settings/settings.module';
import { PdfModule } from './pdf/pdf.module';

import { Audit } from './audit/entities/audit.entity';
import { CrawledPage } from './audit/entities/crawled-page.entity';
import { SeoResult } from './audit/entities/seo-result.entity';
import { PerformanceResult } from './audit/entities/performance-result.entity';
import { SecurityResult } from './audit/entities/security-result.entity';
import { AuditSettings } from './settings/entities/audit-settings.entity';
import { RecommendationHistory } from './recommendations/entities/recommendation-history.entity';

import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const passwordFile = config.get<string>(
          'DATABASE_PASSWORD_FILE',
        );

        if (!passwordFile) {
          throw new Error('DATABASE_PASSWORD_FILE is required');
        }

        const password = readFileSync(passwordFile, 'utf8').trim();

        if (!password) {
          throw new Error('Database password secret is empty');
        }

        return {
          type: 'postgres' as const,
          host: config.get<string>('DATABASE_HOST', 'postgres'),
          port: config.get<number>('DATABASE_PORT', 5432),
          username: config.get<string>(
            'DATABASE_USER',
            'pixiaudit_user',
          ),
          password,
          database: config.get<string>(
            'DATABASE_NAME',
            'pixiaudit_db',
          ),
          entities: [
            User,
            Audit,
            CrawledPage,
            SeoResult,
            PerformanceResult,
            SecurityResult,
            AuditSettings,
            RecommendationHistory,
          ],
          synchronize: true,
        };
      },
    }),

    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        redis: {
          host: config.get<string>('REDIS_HOST', 'redis'),
          port: config.get<number>('REDIS_PORT', 6379),
        },
      }),
    }),

    AuthModule,
    UsersModule,
    AuditModule,
    RecommendationsModule,
    SettingsModule,
    PdfModule,
  ],

  controllers: [HealthController],

  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule {}
