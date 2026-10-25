import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, OneToOne, JoinColumn,
} from 'typeorm';
import { CrawledPage } from './crawled-page.entity';

@Entity('seo_results')
export class SeoResult {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @OneToOne(() => CrawledPage, (page) => page.seoResult, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'page_id' })
  page: CrawledPage;

  @Column({ name: 'page_id' })
  pageId: number;

  @Column({ name: 'h1_count', default: 0 })
  h1Count: number;

  @Column({ name: 'has_canonical', default: false })
  hasCanonical: boolean;

  @Column({ type: 'jsonb', default: [] })
  anomalies: Record<string, any>[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}