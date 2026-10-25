import {
    Entity, PrimaryGeneratedColumn, Column,
    CreateDateColumn, ManyToOne, OneToMany, OneToOne, JoinColumn,
} from 'typeorm';
import { User } from '../../users/user.entity';
import { CrawledPage } from './crawled-page.entity';
import { SecurityResult } from './security-result.entity';

@Entity('audits')
export class Audit {
    @PrimaryGeneratedColumn('increment')
    id: number;

    @Column({ name: 'job_id', unique: true })
    jobId: string;

    @ManyToOne(() => User, { nullable: true })
    @JoinColumn({ name: 'user_id' })
    user: User;

    @Column({ name: 'user_id', nullable: true })
    userId: number;

    @Column({ type: 'text' })
    url: string;

    @Column({
        type: 'enum',
        enum: ['pending', 'in_progress', 'done', 'failed'],
        default: 'pending',
    })
    status: string;

    @Column({ type: 'jsonb', nullable: true })
    config: Record<string, any>;

    @Column({ name: 'pages_crawled', default: 0 })
    pagesCrawled: number;

    @Column({ name: 'global_score', nullable: true, type: 'int' })
    globalScore: number;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @Column({ name: 'completed_at', nullable: true, type: 'timestamp' })
    completedAt: Date;

    @Column({ type: 'jsonb', nullable: true, default: null })
    recommendations: any;

    // ── NEW: Priorities field ─────────────────────────────────────────────
    @Column({ type: 'jsonb', nullable: true })
    priorities: {
        seo: { score: number; level: string };
        performance: { score: number; level: string };
        security: { score: number; level: string };
        global: { score: number; level: string };
    };

    @OneToMany(() => CrawledPage, (page) => page.audit, { cascade: true })
    pages: CrawledPage[];

    // ── FIXED: OneToOne relationship instead of OneToMany ─────────────────
    @OneToOne(() => SecurityResult, (sec) => sec.audit, { cascade: true })
    securityResult: SecurityResult;
}