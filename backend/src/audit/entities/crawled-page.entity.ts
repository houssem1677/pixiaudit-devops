import {
    Entity, PrimaryGeneratedColumn, Column,
    CreateDateColumn, ManyToOne, JoinColumn,
    OneToOne,
} from 'typeorm';
import { Audit } from './audit.entity';
import { SeoResult } from './seo-result.entity';
import { PerformanceResult } from './performance-result.entity';

@Entity('crawled_pages')
export class CrawledPage {
    @PrimaryGeneratedColumn('increment')
    id: number;

    @ManyToOne(() => Audit, (audit) => audit.pages, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'audit_id' })
    audit: Audit;

    @Column({ name: 'audit_id' })
    auditId: number;

    @Column({ type: 'text' })
    url: string;

    @Column({ name: 'http_status', nullable: true, type: 'int' })
    httpStatus: number;

    @Column({ type: 'int', default: 0 })
    depth: number;

    @Column({ nullable: true, type: 'text' })
    error: string;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @OneToOne(() => SeoResult, (seo) => seo.page, { cascade: true })
    seoResult: SeoResult;

    @OneToOne(() => PerformanceResult, (perf) => perf.page, { cascade: true })
    performanceResult: PerformanceResult;
}