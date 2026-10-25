import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, OneToOne, JoinColumn,
} from 'typeorm';
import { Audit } from './audit.entity';

@Entity('security_results')
export class SecurityResult {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @OneToOne(() => Audit, (audit) => audit.securityResult, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'audit_id' })
  audit: Audit;

  @Column({ name: 'audit_id' })
  auditId: number;

  @Column({ type: 'text' })
  url: string;

  @Column({ name: 'ssl_valid', default: false })
  sslValid: boolean;

  @Column({ name: 'ssl_issuer', nullable: true })
  sslIssuer: string;

  @Column({ name: 'ssl_expiry', nullable: true })
  sslExpiry: string;

  @Column({ name: 'ssl_days_remaining', nullable: true, type: 'int' })
  sslDaysRemaining: number;

  @Column({ name: 'present_headers', type: 'jsonb', default: [] })
  presentHeaders: string[];

  @Column({ name: 'missing_headers', type: 'jsonb', default: [] })
  missingHeaders: string[];

  @Column({ type: 'jsonb', default: [] })
  anomalies: Record<string, any>[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}