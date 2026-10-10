import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ExhibitRevision } from '../../exhibits/entities/exhibit-revision.entity';
import { User } from '../../users/entities/user.entity';

@Entity('audit_logs')
@Index('IDX_audit_logs_resource_time', [
  'resourceType',
  'resourceId',
  'occurredAt',
])
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'actor_id', type: 'uuid', nullable: true })
  actorId!: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'actor_id' })
  actor!: User | null;

  @Column({ type: 'varchar', length: 100 })
  action!: string;

  @Column({ name: 'resource_type', type: 'varchar', length: 40 })
  resourceType!: string;

  @Column({ name: 'resource_id', type: 'uuid' })
  resourceId!: string;

  @Column({ name: 'revision_id', type: 'uuid', nullable: true })
  revisionId!: string | null;

  @ManyToOne(() => ExhibitRevision, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'revision_id' })
  revision!: ExhibitRevision | null;

  @Column({ type: 'text', nullable: true })
  reason!: string | null;

  @Column({ name: 'request_id', type: 'varchar', length: 100 })
  requestId!: string;

  @CreateDateColumn({ name: 'occurred_at', type: 'timestamptz' })
  occurredAt!: Date;
}
