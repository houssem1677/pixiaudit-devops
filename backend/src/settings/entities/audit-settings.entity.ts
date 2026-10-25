import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export type AnomalyLevel = 'Critique' | 'Important' | 'Amélioration';

export interface Thresholds {
  good: number;
  ok: number;
}

export interface Weights {
  seo: number;
  performance: number;
  security: number;
}

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

@Entity('audit_settings')
export class AuditSettings {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('jsonb')
  thresholds: Thresholds;

  @Column('jsonb')
  weights: Weights;

  @Column('jsonb')
  anomalyLevels: Record<string, AnomalyLevel>;

  // ✅ NEW COLUMNS
  @Column('jsonb', { 
    default: {
      H1_MISSING: 15,
      META_MISSING: 12,
      TITLE_MISSING: 12,
      TITLE_TOO_SHORT: 5,
      TITLE_TOO_LONG: 3,
      META_TOO_SHORT: 5,
      META_TOO_LONG: 3,
      H1_MULTIPLE: 5,
    }
  })
  seoDeductions: SeoDeductions;

  @Column('jsonb', {
    default: {
      sslValid: 50,
      sslExpiringSoon: -5,
      headerPresent: 10,
      headerMissing: -10,
    }
  })
  securityScoring: SecurityScoring;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}