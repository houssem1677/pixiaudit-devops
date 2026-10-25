import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { firstValueFrom } from 'rxjs';
import { Audit } from '../audit/entities/audit.entity';
import { RecommendationHistory } from './entities/recommendation-history.entity';

const SEO_LABELS: Record<string, string> = {
  H1_MISSING:      'Balise H1 manquante',
  META_MISSING:    'Meta description manquante',
  TITLE_MISSING:   'Titre manquant',
  TITLE_TOO_SHORT: 'Titre trop court',
  TITLE_TOO_LONG:  'Titre trop long',
  META_TOO_SHORT:  'Meta description trop courte',
  META_TOO_LONG:   'Meta description trop longue',
};

const PERF_LABELS: Record<string, string> = {
  HIGH_TTFB:                    'Temps de réponse serveur élevé (TTFB)',
  HIGH_LCP:                     'Largest Contentful Paint élevé (LCP)',
  HIGH_CLS:                     'Cumulative Layout Shift élevé (CLS)',
  IMAGES_WITHOUT_LAZY_LOADING:  'Images sans lazy loading',
  IMAGES_WITHOUT_DIMENSIONS:    'Images sans dimensions définies',
  IMAGES_WITHOUT_SRCSET:        'Images sans attribut srcset',
  RENDER_BLOCKING_SCRIPTS:      'Scripts bloquant le rendu',
  IMAGES_SANS_LAZY:             'Images sans lazy loading',
  IMAGES_SANS_DIMENSIONS:       'Images sans dimensions définies',
  IMAGES_SANS_SRCSET:           'Images sans attribut srcset',
  SCRIPTS_BLOQUANTS:            'Scripts bloquant le rendu',
  TTFB_ELEVE:                   'Temps de réponse serveur élevé (TTFB)',
  LCP_ELEVE:                    'Largest Contentful Paint élevé (LCP)',
  CLS_ELEVE:                    'Cumulative Layout Shift élevé (CLS)',
};

const SEC_LABELS: Record<string, string> = {
  SSL_EXPIRING_SOON: 'Certificat SSL expirant bientôt',
  MISSING_HEADER:    'Header de sécurité manquant',
  SSL_INVALID:       'Certificat SSL invalide',
};

function translateAnomalies(
  anomalies: any[],
  labels: Record<string, string>,
): string[] {
  return [...new Set(
    anomalies.map((a: any) => labels[a.type] || a.type || String(a))
  )].slice(0, 10);
}

@Injectable()
export class RecommendationsService {
  // ✅ FIX: use environment variable (or fallback to Docker service name)
  private readonly aiUrl = process.env.AI_SERVICE_URL || 'http://ai-service:8000';

  constructor(
    private readonly httpService: HttpService,
    @InjectRepository(Audit)
    private readonly auditRepo: Repository<Audit>,
    @InjectRepository(RecommendationHistory)
    private readonly historyRepo: Repository<RecommendationHistory>,
  ) {
    console.log(`[RecommendationsService] AI Service URL: ${this.aiUrl}`);
  }

  // ── Called by AuditProcessor after audit is saved ─────────────────────────
  async generate(payload: {
    auditId:       number;
    jobId:         string;
    url:           string;
    globalScore:   number | null;
    seoAnomalies:  any[];
    perfAnomalies: any[];
    secAnomalies:  any[];
  }): Promise<void> {
    const { auditId, jobId, url, globalScore, seoAnomalies, perfAnomalies, secAnomalies } = payload;

    try {
      console.log(`[RecommendationsService] 🤖 Generating AI recs — job_id=${jobId}`);

      const aiRes = await firstValueFrom(
        this.httpService.post(
          `${this.aiUrl}/recommendations`,
          {
            job_id:         jobId,
            url,
            global_score:   globalScore,
            seo_anomalies:  translateAnomalies(seoAnomalies,  SEO_LABELS),
            perf_anomalies: translateAnomalies(perfAnomalies, PERF_LABELS),
            sec_anomalies:  translateAnomalies(secAnomalies,  SEC_LABELS),
          },
          { timeout: 300_000 }, // 5 minutes – enough for AI generation
        ),
      );

      const recommendations = aiRes.data.recommendations ?? [];

      // Update audit
      await this.auditRepo.update(auditId, { recommendations });

      // Save to history as AI-generated (version 1)
      await this.saveHistory(auditId, recommendations, null, 'ai_generated', 1);

      console.log(`[RecommendationsService] ✅ AI recs saved — job_id=${jobId}`);

    } catch (err: any) {
      // Log more details to help debugging
      console.error(`[RecommendationsService] Full error:`, err);
      console.warn(
        `[RecommendationsService] ⚠️ AI recs failed (non-blocking) — job_id=${jobId}:`,
        err.message,
      );
      if (err.response) {
        console.warn(`[RecommendationsService] Response status: ${err.response.status}`);
        console.warn(`[RecommendationsService] Response data:`, err.response.data);
      }
    }
  }

  // ── Called by RecommendationsController for manual edits ──────────────────
  async update(
    jobId: string,
    recommendations: string,
    userId?: string,
  ): Promise<{ success: boolean; version: number }> {
    const audit = await this.auditRepo.findOne({ where: { jobId } });
    if (!audit) throw new Error('Audit not found');

    // Get latest version number
    const latestHistory = await this.historyRepo.findOne({
      where: { auditId: audit.id },
      order: { version: 'DESC' },
    });

    const newVersion = (latestHistory?.version ?? 0) + 1;

    // Update audit
    await this.auditRepo.update(audit.id, { recommendations: recommendations as any });

    // Save to history as manual edit (convert undefined to null)
    await this.saveHistory(audit.id, recommendations, userId ?? null, 'manual_edit', newVersion);

    return { success: true, version: newVersion };
  }

  // Get recommendation history for an audit
  async getHistory(jobId: string): Promise<RecommendationHistory[]> {
    const audit = await this.auditRepo.findOne({ where: { jobId } });
    if (!audit) throw new Error('Audit not found');

    return this.historyRepo.find({
      where: { auditId: audit.id },
      relations: ['modifiedBy'],
      order: { version: 'DESC' },
    });
  }

  // Private helper to save history
  private async saveHistory(
    auditId: number,
    recommendations: any,
    userId: string | null,
    changeType: 'ai_generated' | 'manual_edit',
    version: number,
  ): Promise<void> {
    const history = this.historyRepo.create({
      auditId,
      recommendations: typeof recommendations === 'string' 
        ? recommendations 
        : JSON.stringify(recommendations),
      modifiedById: userId,
      changeType,
      version,
    });

    await this.historyRepo.save(history);
  }
}