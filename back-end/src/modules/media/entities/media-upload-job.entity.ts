import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Media } from './media.entity';

export enum UploadJobStatus {
  QUEUED = 'queued',
  PROCESSING = 'processing',
  SUCCEEDED = 'succeeded',
  FAILED = 'failed',
}

/** Tên constraint chốt invariant "một (người tạo, Idempotency-Key) ↔ một job". */
export const UPLOAD_JOB_ACTOR_KEY_CONSTRAINT = 'UQ_media_upload_jobs_actor_key';

/**
 * Job upload media bất đồng bộ. Client giữ `id` để hỏi trạng thái; retry cùng
 * `Idempotency-Key` nhận lại đúng job này thay vì tạo job/media mới.
 */
@Entity('media_upload_jobs')
@Unique(UPLOAD_JOB_ACTOR_KEY_CONSTRAINT, ['createdById', 'idempotencyKey'])
@Check('CHK_media_upload_jobs_status', '"status" IN (\'queued\', \'processing\', \'succeeded\', \'failed\')')
@Check('CHK_media_upload_jobs_progress', '"progress" BETWEEN 0 AND 100')
export class MediaUploadJob {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'PK_media_upload_jobs' })
  id!: string;

  // NOT NULL: NULL không bằng nhau trong unique index của PostgreSQL nên sẽ lọt invariant.
  @Column({ name: 'created_by', type: 'uuid' })
  createdById!: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'created_by', foreignKeyConstraintName: 'FK_media_upload_jobs_created_by' })
  createdBy?: User;

  @Column({ name: 'idempotency_key', type: 'varchar', length: 128 })
  idempotencyKey!: string;

  /** SHA-256 của file + metadata, để phát hiện cùng key nhưng nội dung khác. */
  @Column({ name: 'request_checksum', type: 'char', length: 64 })
  requestChecksum!: string;

  @Column({ type: 'varchar', length: 12, default: UploadJobStatus.QUEUED })
  status!: UploadJobStatus;

  @Column({ type: 'smallint', default: 0 })
  progress!: number;

  @Column({ name: 'media_id', type: 'uuid', nullable: true })
  mediaId!: string | null;

  @ManyToOne(() => Media, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'media_id', foreignKeyConstraintName: 'FK_media_upload_jobs_media' })
  media?: Media | null;

  @Column({ name: 'error_code', type: 'varchar', length: 40, nullable: true })
  errorCode!: string | null;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
