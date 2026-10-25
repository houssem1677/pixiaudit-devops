import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, OneToOne, JoinColumn,
} from 'typeorm';
import { CrawledPage } from './crawled-page.entity';

@Entity('performance_results')
export class PerformanceResult {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @OneToOne(() => CrawledPage, (page) => page.performanceResult, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'page_id' })
  page: CrawledPage;

  @Column({ name: 'page_id' })
  pageId: number;

  @Column({ type: 'jsonb', nullable: true })
  metrics: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  causes: Record<string, any>;

  @Column({ type: 'jsonb', default: [] })
  anomalies: Record<string, any>[];

  @Column({ nullable: true, type: 'varchar', length: 50 })
  status: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}