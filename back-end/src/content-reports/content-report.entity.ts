import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ExhibitRevision } from '../exhibit-revisions/exhibit-revision.entity';
import { Exhibit } from '../exhibits/exhibit.entity';
import { User } from '../users/user.entity';

export enum ContentReportStatus {
  OPEN = 'open',
  IN_PROGRESS = 'in_progress',
  RESOLVED = 'resolved',
  DISMISSED = 'dismissed',
}

@Entity('content_reports')
@Index('IDX_content_reports_status_created', ['status', 'createdAt'])
@Check(
  'CHK_content_reports_status',
  '"status" IN (\'open\', \'in_progress\', \'resolved\', \'dismissed\')',
)
export class ContentReport {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'exhibit_id', type: 'uuid' })
  exhibitId!: string;

  @ManyToOne(() => Exhibit, (exhibit) => exhibit.reports, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'exhibit_id' })
  exhibit!: Exhibit;

  @Column({ name: 'reported_revision_id', type: 'uuid', nullable: true })
  reportedRevisionId!: string | null;

  @ManyToOne(() => ExhibitRevision, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'reported_revision_id' })
  reportedRevision!: ExhibitRevision | null;

  @Column({ type: 'varchar', length: 40 })
  category!: string;

  @Column({ type: 'text' })
  message!: string;

  @Column({ type: 'varchar', length: 16, default: ContentReportStatus.OPEN })
  status!: ContentReportStatus;

  @Column({ name: 'assigned_to', type: 'uuid', nullable: true })
  assignedToId!: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'assigned_to' })
  assignedTo!: User | null;

  @Column({ type: 'text', nullable: true })
  resolution!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Column({ name: 'resolved_at', type: 'timestamptz', nullable: true })
  resolvedAt!: Date | null;
}
