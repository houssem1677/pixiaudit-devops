import { Processor, Process } from '@nestjs/bull';
import type { Job } from 'bull';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ScraperService } from './scraper.service';
import { RecommendationsService } from '../recommendations/recommendations.service';
import { SettingsService } from '../settings/settings.service';
import { Audit } from './entities/audit.entity';
import { CrawledPage } from './entities/crawled-page.entity';
import { SeoResult } from './entities/seo-result.entity';
import { PerformanceResult } from './entities/performance-result.entity';
import { SecurityResult } from './entities/security-result.entity';

@Processor('audit')
export class AuditProcessor {
  constructor(
    private readonly scraperService: ScraperService,
    private readonly recommendationsService: RecommendationsService,
    private readonly settingsService: SettingsService,
    @InjectRepository(Audit)
    private readonly auditRepo: Repository<Audit>,
    @InjectRepository(CrawledPage)
    private readonly pageRepo: Repository<CrawledPage>,
    @InjectRepository(SeoResult)
    private readonly seoRepo: Repository<SeoResult>,
    @InjectRepository(PerformanceResult)
    private readonly perfRepo: Repository<PerformanceResult>,
    @InjectRepository(SecurityResult)
    private readonly secRepo: Repository<SecurityResult>,
  ) {}

  @Process('run')
  async handleAudit(job: Job<{
    auditId: number;
    jobId:   string;
    url:     string;
    config:  Record<string, any>;
  }>) {
    const { auditId, jobId, url, config } = job.data;
    console.log(`[AuditProcessor] ── START job_id=${jobId}`);

    try {
      await this.auditRepo.update(auditId, { status: 'in_progress' });

      const configOverride = this._buildConfigOverride(config);

      const result = await this.scraperService.scrape({
        job_id:          jobId,
        url,
        config_override: configOverride,
      });

      const pages         = result.pages ?? {};
      const seoAnomalies:  any[] = [];
      const perfAnomalies: any[] = [];
      const secAnomalies:  any[] = [];

      // ── Process pages ─────────────────────────────────────────────────────
      for (const [pageUrl, pageData] of Object.entries(pages) as any[]) {
        const page = this.pageRepo.create({
          audit:      { id: auditId },
          url:        pageUrl,
          httpStatus: 200,
          depth:      0,
        });
        await this.pageRepo.save(page);

        if (pageData.seo) {
          const seo = this.seoRepo.create({
            page:         { id: page.id },
            h1Count:      pageData.seo.h1_count      ?? 0,
            hasCanonical: pageData.seo.has_canonical ?? false,
            anomalies:    pageData.seo.anomalies     ?? [],
          });
          await this.seoRepo.save(seo);
          seoAnomalies.push(...(pageData.seo.anomalies ?? []));
        }

        if (pageData.performance) {
          const perf = this.perfRepo.create({
            page:      { id: page.id },
            metrics:   pageData.performance.metrics  || null,
            causes:    pageData.performance.causes   || null,
            anomalies: pageData.performance.anomalies ?? [],
            status:    'done',
          });
          await this.perfRepo.save(perf);
          perfAnomalies.push(...(pageData.performance.anomalies ?? []));
        }
      }

      // ── Process security (ONE result per audit) ──────────────────────────
      if (result.security) {
        const sec = this.secRepo.create({
          audit:            { id: auditId },
          url,
          sslValid:         result.security.ssl?.ssl_valid          ?? false,
          sslIssuer:        result.security.ssl?.ssl_issuer,
          sslExpiry:        result.security.ssl?.ssl_expiry,
          sslDaysRemaining: result.security.ssl?.ssl_days_remaining,
          presentHeaders:   result.security.headers?.present        ?? [],
          missingHeaders:   result.security.headers?.missing        ?? [],
          anomalies: [
            ...(result.security.ssl?.anomalies     ?? []),
            ...(result.security.headers?.anomalies ?? []),
          ],
        });
        await this.secRepo.save(sec);
        secAnomalies.push(...(result.security.ssl?.anomalies     ?? []));
        secAnomalies.push(...(result.security.headers?.anomalies ?? []));
      }

      // ── Calculate priorities using SettingsService ───────────────────────
      const priorities = await this.settingsService.calculatePriorities({
        seo:         result.seo_score        ?? null,
        performance: result.performance_score ?? null,
        security:    result.security_score    ?? null,
      });

      // ── Update audit with scores and priorities ──────────────────────────
      await this.auditRepo.update(auditId, {
        status:       'done',
        pagesCrawled: result.pages_crawled ?? 0,
        globalScore:  priorities.global.score,
        priorities:   priorities,
        completedAt:  new Date(),
      });

      console.log(`[AuditProcessor] ✅ Done — job_id=${jobId}, global_score=${priorities.global.score}`);

      // ── Generate AI recommendations ──────────────────────────────────────
      await this.recommendationsService.generate({
        auditId,
        jobId,
        url,
        globalScore:   priorities.global.score,
        seoAnomalies,
        perfAnomalies,
        secAnomalies,
      });

    } catch (error: any) {
      console.error(`[AuditProcessor] ❌ Failed — job_id=${jobId}:`, error.message);
      await this.auditRepo.update(auditId, { status: 'failed' });
    }
  }

  private _buildConfigOverride(config: Record<string, any>): Record<string, any> {
    if (!config || Object.keys(config).length === 0) return {};

    // If config is already in scraper format, pass through directly
    if (config.crawler || config.audits || config.seo || config.security) {
      return config;
    }

    // Otherwise convert from frontend camelCase format
    const override: Record<string, any> = {};

    if (config.analyses) {
      override.audits = {
        seo:         config.analyses.includes('seo_tech'),
        performance: config.analyses.includes('performance'),
        security:    config.analyses.includes('security'),
      };
    }

    override.crawler = {
      ...(config.maxPages    !== undefined && { max_pages:   config.maxPages }),
      ...(config.maxDepth    !== undefined && { max_depth:   config.maxDepth }),
      ...(config.concurrency !== undefined && { concurrency: config.concurrency }),
      ...(config.delayMs     !== undefined && { delay_ms:    config.delayMs }),
      ...(config.auth && {
        auth: {
          enabled:        true,
          login_url:      config.auth.login_url     ?? '',
          username:       config.auth.username       ?? '',
          password:       config.auth.password       ?? '',
          username_field: config.auth.username_field ?? 'username',
          password_field: config.auth.password_field ?? 'password',
        },
      }),
    };

    return override;
  }
}