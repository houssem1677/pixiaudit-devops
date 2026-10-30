import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Audit } from '../../audit/entities/audit.entity';
import { User } from '../../users/user.entity';

@Entity('recommendation_history')
export class RecommendationHistory {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @ManyToOne(() => Audit, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'audit_id' })
  audit: Audit;

  @Column({ name: 'audit_id' })
  auditId: number;

  @Column({ type: 'text' })
  recommendations: string;

  @Column({ name: 'version', default: 1 })
  version: number;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'modified_by' })
  modifiedBy: User;

  @Column({ name: 'modified_by', nullable: true })
  modifiedById: string | null;

  @Column({ name: 'change_type', type: 'varchar', length: 50 })
  changeType: 'ai_generated' | 'manual_edit';

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
