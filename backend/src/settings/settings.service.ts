import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditSettings, Thresholds, Weights, AnomalyLevel } from './entities/audit-settings.entity';
import { UpdateSettingsDto } from './dto/settings.dto';

// ✅ NEW INTERFACES
export interface SeoDeductions {
  H1_MISSING: number;
  META_MISSING: number;
  TITLE_MISSING: number;
  TITLE_TOO_SHORT: number;
  TITLE_TOO_LONG: number;
  META_TOO_SHORT: number;
  META_TOO_LONG: number;
  H1_MULTIPLE: number;
}

export interface SecurityScoring {
  sslValid: number;
  sslExpiringSoon: number;
  headerPresent: number;
  headerMissing: number;
}

@Injectable()
export class SettingsService {
  constructor(
    @InjectRepository(AuditSettings)
    private readonly settingsRepo: Repository<AuditSettings>,
  ) {}

  // ── Get active settings (or create default if none exist) ────────────────
  async getActiveSettings(): Promise<AuditSettings> {
    let settings = await this.settingsRepo.findOne({
      where: { isActive: true },
      order: { updatedAt: 'DESC' },
    });

    if (!settings) {
      // Create default settings
      settings = await this.createDefaultSettings();
    }

    return settings;
  }

  // ── Update settings ───────────────────────────────────────────────────────
  async updateSettings(dto: UpdateSettingsDto): Promise<AuditSettings> {
    // Validate weights sum to 100
    const totalWeight = dto.weights.seo + dto.weights.performance + dto.weights.security;
    if (totalWeight !== 100) {
      throw new Error(`Weights must sum to 100, got ${totalWeight}`);
    }

    let settings = await this.getActiveSettings();

    // Update settings
    settings.thresholds = dto.thresholds;
    settings.weights = dto.weights;
    settings.anomalyLevels = dto.anomalyLevels;
    
    // ✅ NEW - Update scoring parameters
    if (dto.seoDeductions) {
      settings.seoDeductions = dto.seoDeductions;
    }
    if (dto.securityScoring) {
      settings.securityScoring = dto.securityScoring;
    }

    return this.settingsRepo.save(settings);
  }

  // ── Priority Calculation Algorithm ───────────────────────────────────────
  
  /**
   * Calculate priority level based on score and thresholds
   */
  calculatePriorityLevel(score: number, thresholds: Thresholds): string {
    if (score >= thresholds.good) return 'Amélioration';
    if (score >= thresholds.ok) return 'Important';
    return 'Critique';
  }

  /**
   * Calculate global score from category scores using weights
   */
  calculateGlobalScore(
    scores: { seo?: number; performance?: number; security?: number },
    weights: Weights,
  ): number {
    const seoScore = scores.seo ?? 0;
    const perfScore = scores.performance ?? 0;
    const secScore = scores.security ?? 0;

    const weightedScore =
      (seoScore * weights.seo +
       perfScore * weights.performance +
       secScore * weights.security) / 100;

    return Math.round(weightedScore);
  }

  /**
   * Calculate priorities for an audit
   */
  async calculatePriorities(scores: {
    seo?: number;
    performance?: number;
    security?: number;
  }): Promise<{
    seo: { score: number; level: string };
    performance: { score: number; level: string };
    security: { score: number; level: string };
    global: { score: number; level: string };
  }> {
    const settings = await this.getActiveSettings();

    const seoScore = scores.seo ?? 0;
    const perfScore = scores.performance ?? 0;
    const secScore = scores.security ?? 0;

    const globalScore = this.calculateGlobalScore(scores, settings.weights);

    return {
      seo: {
        score: seoScore,
        level: this.calculatePriorityLevel(seoScore, settings.thresholds),
      },
      performance: {
        score: perfScore,
        level: this.calculatePriorityLevel(perfScore, settings.thresholds),
      },
      security: {
        score: secScore,
        level: this.calculatePriorityLevel(secScore, settings.thresholds),
      },
      global: {
        score: globalScore,
        level: this.calculatePriorityLevel(globalScore, settings.thresholds),
      },
    };
  }

  /**
   * Get anomaly priority level (for badge display)
   */
  async getAnomalyLevel(anomalyType: string): Promise<AnomalyLevel> {
    const settings = await this.getActiveSettings();
    return settings.anomalyLevels[anomalyType] || 'Important';
  }

  // ── Private: Create default settings ─────────────────────────────────────
  private async createDefaultSettings(): Promise<AuditSettings> {
    const defaultAnomalyLevels: Record<string, AnomalyLevel> = {
      // Critique
      H1_MISSING: 'Critique',
      META_MISSING: 'Critique',
      TITLE_MISSING: 'Critique',
      HIGH_TTFB: 'Critique',
      HIGH_LCP: 'Critique',
      RENDER_BLOCKING_SCRIPTS: 'Critique',
      MISSING_HEADER: 'Critique',
      SSL_INVALID: 'Critique',
      // Important
      TITLE_TOO_SHORT: 'Important',
      TITLE_TOO_LONG: 'Important',
      META_TOO_SHORT: 'Important',
      META_TOO_LONG: 'Important',
      HIGH_CLS: 'Important',
      IMAGES_WITHOUT_LAZY_LOADING: 'Important',
      IMAGES_WITHOUT_DIMENSIONS: 'Important',
      SSL_EXPIRING_SOON: 'Important',
      // Amélioration
      IMAGES_WITHOUT_SRCSET: 'Amélioration',
    };

    // ✅ NEW - Default SEO deductions
    const defaultSeoDeductions: SeoDeductions = {
      H1_MISSING: 15,
      META_MISSING: 12,
      TITLE_MISSING: 12,
      TITLE_TOO_SHORT: 5,
      TITLE_TOO_LONG: 3,
      META_TOO_SHORT: 5,
      META_TOO_LONG: 3,
      H1_MULTIPLE: 5,
    };

    // ✅ NEW - Default security scoring
    const defaultSecurityScoring: SecurityScoring = {
      sslValid: 50,
      sslExpiringSoon: -5,
      headerPresent: 10,
      headerMissing: -10,
    };

    const settings = this.settingsRepo.create({
      thresholds: {
        good: 70,
        ok: 50,
      },
      weights: {
        seo: 40,
        performance: 40,
        security: 20,
      },
      anomalyLevels: defaultAnomalyLevels,
      seoDeductions: defaultSeoDeductions,      // ✅ NEW
      securityScoring: defaultSecurityScoring,  // ✅ NEW
      isActive: true,
    });

    return this.settingsRepo.save(settings);
  }
}